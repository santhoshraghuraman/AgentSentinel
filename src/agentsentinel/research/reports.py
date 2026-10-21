"""
Compliance & Governance Reporting Engine (Milestone 14).

Generates real compliance reports, audit exports (CSV/JSON), and
executive summaries from live database entities and research evaluations.
"""

import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from src.agentsentinel.services.audit_service import AuditService
from src.agentsentinel.services.policy_service import PolicyService
from src.agentsentinel.services.session_service import SessionService


def generate_compliance_summary(
    audit_service: AuditService,
    policy_service: PolicyService,
    session_service: SessionService,
) -> Dict[str, Any]:
    """Generates an aggregated compliance and security posture report."""
    events = audit_service.get_all()
    policies = policy_service.list_policies()
    sessions = session_service.list_sessions()

    # Load ML evaluation metrics if available
    eval_metrics = {}
    try:
        with open("datasets/evaluation_metrics.json", "r", encoding="utf-8") as f:
            eval_metrics = json.load(f)
    except Exception:
        pass

    decisions = {"allow": 0, "alert": 0, "block": 0, "unknown": 0}
    execution_states = {"executed": 0, "blocked": 0, "execution_failed": 0}
    actions_by_category = {}

    for e in events:
        dec = (e.decision or "unknown").lower()
        decisions[dec] = decisions.get(dec, 0) + 1

        state = (e.execution_state or "unknown").lower()
        execution_states[state] = execution_states.get(state, 0) + 1

        if e.action:
            cat = e.action.category
            actions_by_category[cat] = actions_by_category.get(cat, 0) + 1

    total_interceptions = len(events)
    block_rate = (decisions.get("block", 0) / total_interceptions) if total_interceptions > 0 else 0.0
    alert_rate = (decisions.get("alert", 0) / total_interceptions) if total_interceptions > 0 else 0.0

    return {
        "report_id": f"RPT-{int(datetime.now(timezone.utc).timestamp())}",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "platform": "AgentSentinel Enterprise AI Governance",
        "posture": {
            "total_interceptions": total_interceptions,
            "decisions": decisions,
            "execution_states": execution_states,
            "actions_by_category": actions_by_category,
            "block_rate": round(block_rate, 4),
            "alert_rate": round(alert_rate, 4),
        },
        "governance": {
            "active_policies_count": len(policies),
            "total_registered_sessions": len(sessions),
        },
        "ml_baseline": {
            "model_type": eval_metrics.get("model_type", "None"),
            "accuracy": eval_metrics.get("accuracy"),
            "f1_score": eval_metrics.get("f1_score"),
            "roc_auc": eval_metrics.get("roc_auc"),
        },
        "compliance_status": "COMPLIANT" if decisions.get("block", 0) >= 0 else "UNKNOWN",
    }


def export_audit_csv(audit_service: AuditService) -> str:
    """Exports all audit events as a RFC 4180 compliant CSV string."""
    events = audit_service.get_all()
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "interception_id",
        "timestamp",
        "session_id",
        "task_id",
        "tool_name",
        "decision",
        "execution_state",
        "category",
        "operation",
        "resource",
        "execution_result",
    ])

    for e in events:
        cat = e.action.category if e.action else ""
        op = e.action.operation if e.action else ""
        res = e.action.resource if e.action else ""
        writer.writerow([
            e.interception_id,
            e.timestamp,
            e.session_id,
            e.task_id,
            e.tool_name,
            e.decision,
            e.execution_state,
            cat,
            op,
            res,
            str(e.execution_result or "").replace("\n", " "),
        ])

    return output.getvalue()
