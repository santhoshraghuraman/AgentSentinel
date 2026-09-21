"""
Runtime Interceptor (Milestone 8).

The core runtime interception engine that connects the M1–M7 static
analysis pipeline to live agent tool calls.

Exactly one security decision path exists:
    Raw Invocation
    → Adapter Validation/Normalization
    → RuntimeInterceptor
    → M3/M4/M5/M6/M7
    → Governance Decision
    → Adapter Execution Gate

No alternate execution path may bypass this decision gate.

This engine does NOT:
    - Execute tools directly (that is the adapter's responsibility).
    - Modify M1–M7 domain contracts.
    - Create duplicate M5/M6/M7 implementations.
    - Produce fabricated RiskAssessment, ActionAuthorizationResult,
      or ActionDecisionRecord when internal failures occur.
    - Use timestamps for ordering (sequence_number is authoritative).
    - Claim cross-run deterministic thread scheduling.

Governance determinism:
    Deterministic for identical inputs and identical ordered runtime
    state. Concurrent scheduling order is runtime-dependent and is
    not claimed to be reproducible across runs.
"""

import dataclasses
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple

from src.agentsentinel.models.normalized import (
    NormalizedAction,
    NormalizedEvent,
    NormalizedTrajectory,
)
from src.agentsentinel.models.trajectory import EventRole
from src.agentsentinel.representations.behavioral_sequence import BehavioralSequence
from src.agentsentinel.features.extractor import TrajectoryFeatureExtractor
from src.agentsentinel.risk.engine import BehavioralRiskEngine
from src.agentsentinel.risk.models import RiskAssessment, Severity
from src.agentsentinel.authorization.engine import TaskContextAuthorizer
from src.agentsentinel.authorization.models import (
    ActionAuthorizationResult,
    AuthorizationStatus,
    TaskContext,
)
from src.agentsentinel.governance.engine import PolicyFusionEngine
from src.agentsentinel.governance.models import (
    ActionDecisionRecord,
    GovernanceDecision,
    GovernancePolicy,
    GovernanceReason,
)
from src.agentsentinel.runtime.state import (
    ExecutionState,
    RuntimeEvent,
    RuntimeSession,
)
from src.agentsentinel.runtime.audit import AuditEvent


logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────
# Interception Result
# ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class InterceptionResult:
    """
    The definitive result of a runtime interception.

    action is None if adapter-side normalization failed.
    action_record is None if any internal failure triggered fail-safe BLOCK.

    No fabricated ActionDecisionRecord, RiskAssessment, or
    ActionAuthorizationResult is ever produced when internal
    failures block evaluation.
    """
    interception_id: str
    session_id: str
    sequence_number: int
    decision: GovernanceDecision
    action: Optional[NormalizedAction]
    action_record: Optional[ActionDecisionRecord]
    error_message: Optional[str]


# ──────────────────────────────────────────────────────────
# Runtime Interceptor
# ──────────────────────────────────────────────────────────

class RuntimeInterceptor:
    """
    Core runtime interception engine.

    Maintains a registry of RuntimeSessions and provides the single
    entry point for evaluating tool calls through the M3→M4→M5→M6→M7
    pipeline.

    Thread safety: All session state updates are serialized through
    the session's threading.Lock.
    """

    def __init__(
        self,
        risk_engine: Optional[BehavioralRiskEngine] = None,
        authorizer: Optional[TaskContextAuthorizer] = None,
        governance_engine: Optional[PolicyFusionEngine] = None,
    ):
        self._risk_engine = risk_engine or BehavioralRiskEngine()
        self._authorizer = authorizer or TaskContextAuthorizer()
        self._governance_engine = governance_engine or PolicyFusionEngine()
        self._feature_extractor = TrajectoryFeatureExtractor()

    def intercept(
        self,
        session: RuntimeSession,
        action: NormalizedAction,
    ) -> Tuple[InterceptionResult, AuditEvent]:
        """
        Evaluate a single action through the M3→M4→M5→M6→M7 pipeline.

        This is the ONLY entry point for runtime governance evaluation.

        Args:
            session: The runtime session this call belongs to.
            action: The pre-normalized action from the adapter.

        Returns:
            A tuple containing:
            - InterceptionResult with the governance decision.
            - AuditEvent recording the decision.
            action_record is None if any internal failure occurs.
        """
        lock = session.acquire_lock()
        with lock:
            interception_id = str(uuid.uuid4())
            seq = session.next_sequence_number()

            # Snapshot task context and policies for this interception
            task_context, policies = session.snapshot_context()

            # Create a RuntimeEvent for the current ATTEMPTED action
            normalized_event = NormalizedEvent(
                id=f"runtime_{interception_id}",
                timestamp=datetime.utcnow().isoformat(),
                role=EventRole.TOOL_CALL,
                content=None,
                normalized_actions=[action],
            )
            runtime_event = RuntimeEvent(
                sequence_number=seq,
                normalized_event=normalized_event,
                execution_state=ExecutionState.ATTEMPTED,
                interception_id=interception_id,
            )

            # Append to session BEFORE evaluation so the current action
            # is part of the trajectory during M4/M5 assessment
            session.append_event(runtime_event)

            # Evaluate through M3→M4→M5→M6→M7
            try:
                result = self._evaluate_pipeline(
                    session=session,
                    runtime_event=runtime_event,
                    action=action,
                    task_context=task_context,
                    policies=policies,
                    interception_id=interception_id,
                    seq=seq,
                )
            except Exception as e:
                # Post-normalization M3/M4/M5/M6/M7 failure:
                # fail-safe BLOCK with the valid NormalizedAction
                logger.error(
                    "M3-M7 pipeline failure during interception %s: %s",
                    interception_id, e,
                    exc_info=True,
                )
                runtime_event.execution_state = ExecutionState.BLOCKED
                result = InterceptionResult(
                    interception_id=interception_id,
                    session_id=session.session_id,
                    sequence_number=seq,
                    decision=GovernanceDecision.BLOCK,
                    action=action,
                    action_record=None,
                    error_message=f"Pipeline failure: {e}",
                )
                audit = AuditEvent(
                    interception_id=result.interception_id,
                    session_id=result.session_id,
                    sequence_number=result.sequence_number,
                    timestamp=datetime.utcnow(),
                    action=result.action,
                    decision=result.decision,
                    action_record=result.action_record,
                    execution_state=ExecutionState.BLOCKED,
                    error_message=result.error_message,
                )
                return result, audit

            # Update execution state based on decision
            if result.decision == GovernanceDecision.BLOCK:
                runtime_event.execution_state = ExecutionState.BLOCKED
            # ALLOW/ALERT: state remains ATTEMPTED until adapter confirms execution

            audit = AuditEvent(
                interception_id=result.interception_id,
                session_id=result.session_id,
                sequence_number=result.sequence_number,
                timestamp=datetime.utcnow(),
                action=result.action,
                decision=result.decision,
                action_record=result.action_record,
                execution_state=runtime_event.execution_state,
                error_message=result.error_message,
            )
            return result, audit

    def mark_executed(self, session: RuntimeSession, interception_id: str) -> None:
        """
        Mark an ATTEMPTED event as EXECUTED after successful tool execution.
        Called by the adapter after the tool runs successfully.
        """
        if session is None:
            return
        with session.acquire_lock():
            for evt in session.events:
                if evt.interception_id == interception_id:
                    if evt.execution_state == ExecutionState.ATTEMPTED:
                        evt.execution_state = ExecutionState.EXECUTED
                    break

    def mark_execution_failed(
        self, session: RuntimeSession, interception_id: str, error: str,
    ) -> None:
        """
        Mark an ATTEMPTED event as EXECUTION_FAILED after tool execution failure.
        Called by the adapter when tool execution raises an exception.

        The original governance decision remains unchanged.
        """
        if session is None:
            return
        with session.acquire_lock():
            for evt in session.events:
                if evt.interception_id == interception_id:
                    if evt.execution_state == ExecutionState.ATTEMPTED:
                        evt.execution_state = ExecutionState.EXECUTION_FAILED
                    break

    # ──────────────────────────────────────────────────────────
    # Internal Pipeline
    # ──────────────────────────────────────────────────────────

    def _evaluate_pipeline(
        self,
        session: RuntimeSession,
        runtime_event: RuntimeEvent,
        action: NormalizedAction,
        task_context: TaskContext,
        policies: Tuple[GovernancePolicy, ...],
        interception_id: str,
        seq: int,
    ) -> InterceptionResult:
        """
        Execute the M3→M4→M5→M6→M7 pipeline.

        Raises on any internal failure (caught by caller for fail-safe).
        """
        # M3: Build transient trajectory from session state
        trajectory = session.build_m4_trajectory(runtime_event)
        behavioral_sequence = BehavioralSequence(trajectory)

        # M4: Extract features
        features = self._feature_extractor.extract(behavioral_sequence)

        # M5: Assess behavioral risk
        risk_assessment = self._risk_engine.evaluate(features)

        # M6: Authorize the action against the snapshotted TaskContext
        auth_result = self._authorizer.authorize_action(action, task_context)

        # M7: Governance fusion
        action_record = self._governance_engine.evaluate(
            action=action,
            risk_severity=risk_assessment.overall_severity,
            auth_result=auth_result,
            policies=policies,
        )

        # Inject explainability fields for Phase 4.2B
        ml_prob = None
        if "MLBehavioralRisk" in risk_assessment.dimensions:
            ml_dim = risk_assessment.dimensions["MLBehavioralRisk"]
            if ml_dim.evidence and len(ml_dim.evidence) > 0:
                ml_prob = ml_dim.evidence[0].feature_value
                
        risk_score = None
        if risk_assessment.overall_severity is not None:
            risk_score = float(risk_assessment.overall_severity.value)
            
        features_dict = dataclasses.asdict(features)
        
        action_record = dataclasses.replace(
            action_record,
            ml_probability=ml_prob,
            risk_score=risk_score,
            features=features_dict
        )

        return InterceptionResult(
            interception_id=interception_id,
            session_id=session.session_id,
            sequence_number=seq,
            decision=action_record.decision,
            action=action,
            action_record=action_record,
            error_message=None,
        )

    # ──────────────────────────────────────────────────────────
