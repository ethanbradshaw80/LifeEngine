# Claude Rules

A readable expansion of the AI-development rules. **`../CLAUDE.md` remains the
controlling constitution** — this document explains and operationalizes it.

Written for someone still learning to code. If a rule here seems obvious, it is
because someone learned it the hard way.

---

## 1. Before writing any code

**Read the spec first.** `CLAUDE.md`, then the relevant document from
`DESIGN_INDEX.md` or `TECHNICAL_INDEX.md`. If no spec exists for what you are about to
build, write the spec first — it will be short, and it will prevent building the wrong
thing.

**Confirm the milestone.** Check `MILESTONE_PLAN.md`. If the work is not in the current
milestone's in-scope list, it does not get built. If it appears in the out-of-scope
list, it definitely does not get built.

**Apply the Three Gates.** Realism, Interaction, Story. A feature failing any gate is
rejected, simplified, aggregated, or deferred.

---

## 2. The rules that cannot be bent

These four are not style preferences. Violating any of them means work has to be
redone, sometimes extensively.

### The engine imports nothing

`packages/engine` imports from `packages/shared` and nothing else. No React. No DOM. No
`window`, `document`, `localStorage`, `fetch`. No clock, no timers, no storage, no
network.

*Why:* it is what keeps the engine deterministic, testable, worker-safe, and portable
between browser and server. It has already survived two total platform changes at zero
code cost.

### Determinism is absolute

Same seed, same version, same decisions ⇒ byte-identical results. Every banned
construct in `DETERMINISM.md` §5 is banned, not discouraged.

*Why:* it cannot be retrofitted. A simulation that is 95% deterministic is
non-deterministic, and every bug in it becomes irreproducible.

### One owner per piece of data

Every field has exactly one owning domain (`DOMAIN_MAP.md` §2). Others query it or send
a command. Nobody else writes it.

*Why:* two writers eventually disagree, and there is no principled way to decide which
copy is right.

### Causal records are written when the decision happens

Not reconstructed afterward. Not generated when the player asks.

*Why:* invented explanations contradict each other, and players notice immediately.

---

## 3. Working in bounded loops

Never make random changes hoping something works. Use this loop:

1. Read the relevant specification.
2. Inspect the existing implementation.
3. Define the narrow intended change — one sentence.
4. Implement the smallest coherent change.
5. Build.
6. Run the tests.
7. Analyse failures — understand *why*, do not guess.
8. Fix root causes, not symptoms.
9. Rerun.
10. Review the diff line by line.
11. Update the documentation.
12. Stop when the acceptance criteria are met.

Every loop needs an objective, explicit acceptance criteria, a bounded iteration limit,
and an escalation rule.

**When stuck, escalate rather than thrash.** After three failed attempts, stop and
report: what failed, what evidence was collected, what was tried, the likely cause, and
the recommended next step. Three careful attempts beat twenty random ones.

---

## 4. Never do these

| Never | Why it matters |
|---|---|
| Delete or weaken a test to get a green result | The test was protecting something. Green with deleted tests is worse than red. |
| Claim something is tested when it was not run | Everything downstream is then built on a false belief |
| Fabricate test output or results | Same, but worse |
| Hide a remaining failure | It will surface later, at a worse time, with more built on top of it |
| Suppress a warning without understanding it | Warnings are usually right |
| Perform a large uncontrolled rewrite | Impossible to review, impossible to bisect when it breaks |
| Change a public contract without a migration note | Breaks saves and other domains silently |
| Add a dependency without documented justification | Every dependency is a permanent maintenance obligation |
| Commit a secret | Assume anything committed is public forever, even after a force-push |
| Use real people's data | Legal and ethical exposure |
| Write custom authentication | Password hashing and session handling are easy to get dangerously wrong |

---

## 5. Honesty requirements

**Distinguish verified from assumed.** "The tests pass" means they were run and passed.
"This should work" means it was not tested. Never let the second sound like the first.

**Report confidence.** When something depends on incomplete information, say so.

**Flag what needs verification.** Pricing, provider status, library maintenance, and
platform capabilities go stale. Anything of that kind in these documents — including
this one — should be checked against a current source before being relied on.

**Do not flatter the design.** Identify contradictions, excessive scope, unrealistic
assumptions, and performance dangers. The objective is a project that gets finished,
not one that sounds impressive.

**Report outcomes faithfully.** If a milestone slipped, say so. If a shortcut was
taken, name it. If part of the work was skipped, say which part and why.

---

## 6. Scope discipline

Scope explosion is rated the top risk in `RISK_REGISTER.md`. The specific failure mode
is not one large bad decision — it is twenty small reasonable ones.

**Milestone out-of-scope lists are binding.** Changing one requires an ADR. That
friction is deliberate.

**"While I'm in here" is the warning phrase.** Refactoring an unrelated file, adding a
small feature, fixing an unrelated bug — each is individually reasonable and
collectively fatal. Note it, finish the current task, do it separately.

**New system?** Three Gates first, then a design document, then code. Never the reverse.

---

## 7. Using AI on this project

The developer is still learning. That creates a specific failure mode: AI-generated
code that looks right, passes a casual read, and quietly violates an architectural
rule.

**Small diffs.** A change small enough to actually review is worth more than a large
correct one you cannot check.

**Ask for plain-English explanations.** If the explanation of what code does is not
understandable, the code should not be committed. Not understanding your own codebase
is how projects become unmaintainable.

**Independent review is required** for: simulation scheduling, deterministic
randomness, core person state, decision logic, memory, relationship graphs, economy
calculations, military and war resolution, persistence, save migrations, generational
transitions, performance-critical code, shared domain interfaces, major refactors, and
**anything touching authentication or user data**. The reviewer must not be the author.

**Lean on automated enforcement.** The import-graph test, the banned-construct test,
and the determinism tests catch entire classes of error that a learning reviewer would
miss. They are worth more than careful reading — write them early.

**Model routing** (`CLAUDE.md` §10): use the least expensive model that can reliably do
the job. Cheap models for inventory, formatting, and mechanical transformation. Mid-tier
for standard implementation and tests. Top-tier for architecture, persistence strategy,
hard debugging, and anything hard to reverse. Do not reach for the largest model just
because a task feels important.

---

## 8. Documentation

**Update docs in the same commit as the change.** Documentation updated "later" is
documentation that is wrong.

**Record decisions as ADRs.** If a choice would be expensive to reverse, or if someone
might later ask "why is it done this way," it is an ADR.

**Keep the bootstrap untouched.** `LIFE_ENGINE_BOOTSTRAP.md` is preserved history.
Changes are recorded as ADRs, never as edits to that file.

**When docs and code disagree, one of them is a bug.** Decide which, and fix it — do not
leave both.

---

## 9. Definition of done

A change is done when:

- [ ] It is in the current milestone's scope
- [ ] It passes the Three Gates, if it is a feature
- [ ] Tests exist and pass — actually run, not assumed
- [ ] Determinism tests still pass
- [ ] The import-graph test still passes
- [ ] The diff has been reviewed line by line
- [ ] Documentation is updated in the same commit
- [ ] Any significant decision is recorded as an ADR
- [ ] Independent review is complete, if §7 requires it
- [ ] You could explain to someone else what it does and why

Nine of these are mechanical. The tenth is the real test.
