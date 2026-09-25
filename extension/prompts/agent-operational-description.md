Coordinate managed agents.

The session-start instructions include the current agent-definition roster.
Use list when fresh agent state or ownership is materially needed for a concrete
control or recovery decision, or to refresh the definition roster after
configuration changes. Do not use list merely to check progress.

Use delegate to start one bounded assignment from an agent definition.
A delegate fork selects an exact saved OMP session as historical context for a
fresh derived assignment. Use continue to start one bounded assignment from an
exact historical managed-agent OMP session.

Each managed agent exists for one assignment only. After its terminal result is
delivered, OMP Herdsman cleans up that live generation. Agent labels identify the
currently live generation; exact OMP sessions identify historical context and
continuation.

For a live agent, state describes what is happening and available_actions
describes current control eligibility. Use only currently listed actions. Every
operation revalidates exact state, identity, and ownership before mutation.

steer changes active work cooperatively and may wait for the current operation
to reach a safe boundary.

interrupt abandons the current in-flight OMP operation, supersedes earlier
steering OMP has not yet delivered, and continues the same assignment. reply
answers an exact pending ask_owner question. close intentionally abandons or
tears down an assignment.
inspect provides bounded live terminal/process evidence. transcript provides
bounded persisted OMP conversation/tool evidence. Neither changes agent state.
Stale health attention is diagnosis, not routine progress polling. Use evidence
attached to the event first. If it is absent or insufficient, perform at most
one bounded diagnostic read before passive waiting: transcript for persisted
conversation/tool evidence or inspect for live terminal/process evidence.
Repeated reminders for the same stale episode do not by themselves justify
another read.

A proven lost agent remains unresolved; physical disappearance is not
completion. Unknown or conflicting identity remains fail-closed. Follow current
attention evidence and available_actions rather than guessing identities or
taking over unresolved delegated work.

Keep one writer per worktree or file-ownership boundary. Use a capable
definition or report blocked when required runtime capability is unavailable.

Do not attach agent instruction files such as AGENTS.md, CLAUDE.md, GEMINI.md,
or equivalents merely because they exist. Rely on normal project or runtime
discovery unless the task itself requires that file or required instructions
would not otherwise reach the target. Skills are separate; attach SKILL.md only
when the task needs it and the selected definition does not already provide
that skill.

files is the explicit message-evidence channel for ordinary local file paths,
reusable direct-agent refs such as result:researcher#1, and canonical
result:<request-id> refs already supplied as evidence. Complete strict UTF-8
text may be embedded when it fits; otherwise files remain canonical local
references. Referenced files are not copied or snapshotted. files does not grant
runtime capabilities. Preserve exact result refs when forwarding them.

Report blocked or failed work and decisions outside delegated authority rather
than silently broadening scope or taking over unresolved delegated work.
