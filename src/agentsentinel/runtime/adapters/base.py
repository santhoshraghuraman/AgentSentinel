"""
Framework Adapter Interface (Milestone 8).

Defines the abstract base for framework-specific adapters that bridge
an agent framework's tool execution mechanism to the AgentSentinel
RuntimeInterceptor.

Direction of control:
    Agent Framework → Framework Adapter → RuntimeInterceptor → M3–M7
    Adapter Execution Gate → Actual Tool Execution (or BLOCK)

The adapter is responsible for:
    - Receiving framework-specific tool calls.
    - Constructing a ValidatedInvocation (immutable arguments + callable).
    - Normalizing the raw call into a NormalizedAction.
    - Invoking RuntimeInterceptor.intercept().
    - Executing the EXACT ValidatedInvocation only when ALLOW or ALERT.
    - Returning a safe error to the agent when BLOCK.
    - Never executing the tool if normalization fails.

The adapter MUST NOT:
    - Reconstruct arguments after authorization.
    - Re-read mutable arguments.
    - Substitute another callable.
    - Re-normalize different arguments.
    - Change tool identity or execution context.
    - Bypass the RuntimeInterceptor.

TOCTOU prevention:
    The exact ValidatedInvocation that produced the governed
    NormalizedAction is the only invocation permitted to execute.
"""

import abc
import logging
from typing import Any, Optional

from src.agentsentinel.models.normalized import NormalizedAction
from src.agentsentinel.governance.models import GovernanceDecision
from src.agentsentinel.runtime.state import ExecutionState, ValidatedInvocation
from src.agentsentinel.runtime.interceptor import InterceptionResult, RuntimeInterceptor


logger = logging.getLogger(__name__)


class BaseFrameworkAdapter(abc.ABC):
    """
    Abstract base class for framework-specific adapters.

    Subclasses implement normalize() and handle_block() for their
    specific agent framework.
    """

    def __init__(self, interceptor: RuntimeInterceptor):
        self._interceptor = interceptor

    @abc.abstractmethod
    def normalize(self, invocation: ValidatedInvocation) -> Optional[NormalizedAction]:
        """
        Normalize a ValidatedInvocation into a NormalizedAction.

        Returns None if normalization fails. Normalization failure
        results in fail-safe BLOCK with zero tool executions.
        """
        ...

    @abc.abstractmethod
    def handle_block(self, result: InterceptionResult) -> Any:
        """
        Return a framework-specific safe error response for a BLOCK.

        This is what the agent sees when its tool call is rejected.
        """
        ...

    def execute_tool_call(
        self,
        session_id: str,
        invocation: ValidatedInvocation,
    ) -> Any:
        """
        Full interception lifecycle for a tool call.

        1. Normalize the invocation.
        2. If normalization fails → fail-safe BLOCK, zero executions.
        3. Submit to RuntimeInterceptor.
        4. If BLOCK → return safe error.
        5. If ALLOW/ALERT → execute the EXACT ValidatedInvocation once.
        6. Mark execution state in the session.

        Returns:
            Tool execution result for ALLOW/ALERT.
            Framework-specific error for BLOCK/normalization failure.
        """
        # Step 1: Normalize
        action = self.normalize(invocation)

        if action is None:
            # Adapter normalization failure → fail-safe BLOCK
            # No fabricated NormalizedAction, RiskAssessment, etc.
            result = InterceptionResult(
                interception_id="normalization_failure",
                session_id=session_id,
                sequence_number=0,
                decision=GovernanceDecision.BLOCK,
                action=None,
                action_record=None,
                error_message="Adapter normalization failure: unable to normalize invocation",
            )
            logger.warning(
                "Normalization failure for session %s, tool %s — fail-safe BLOCK",
                session_id, invocation.tool_name,
            )
            return self.handle_block(result)

        # Step 2: Intercept through M3→M4→M5→M6→M7
        result, _ = self._interceptor.intercept(session_id, action)

        # Step 3: Execution gate
        if result.decision == GovernanceDecision.BLOCK:
            return self.handle_block(result)

        # Step 4: Execute the EXACT ValidatedInvocation (ALLOW/ALERT)
        try:
            tool_result = invocation.execute()
        except Exception as e:
            # Execution failure: mark as EXECUTION_FAILED
            # Original governance decision remains unchanged
            self._interceptor.mark_execution_failed(
                session_id, result.interception_id, str(e),
            )
            logger.error(
                "Tool execution failed for interception %s: %s",
                result.interception_id, e,
            )
            raise

        # Step 5: Mark as EXECUTED
        self._interceptor.mark_executed(session_id, result.interception_id)

        return tool_result
