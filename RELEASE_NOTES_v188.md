# The Life Simulator — the Squad update

*Everything since v187. For the devlog / update notes.*

---

If v187 gave you a unit, this one gives you the nine men in it — and gives every
job in the army its own war instead of everybody sharing one.

Your existing saves keep working. New games will play out differently.

---

## Your squad is nine men, not the whole base

The game used to treat everyone at your posting as one enormous squad with a
single squad leader. A base of four hundred people had exactly one squad in it,
which is why the unit on your record never changed.

It's now built the way it actually works:

- **Fire team** — four men, a team leader and three others
- **Squad** — nine, two fire teams under a squad leader
- **Platoon** — four squads, a lieutenant and a platoon sergeant
- **Company** — four platoons under a captain

You get assigned by when you arrived, and you stay put — nobody gets quietly
shuffled between squads because somebody above them got promoted. The roster
screen now shows it properly: you, then Alpha Team, then Bravo Team, with your
platoon and company above.

## Every job has its own war now

There were 24 combat scenes shared between every trade in the army. There are
now **234**, and they belong to somebody:

- **Riflemen** get twenty of their own — every one about ground, and what
  taking the next piece of it costs.
- **Snipers** get twenty. Finish Sniper School and you *are* the sniper from
  then on, for every deployment after — your own scenes, your own line on the
  roster, and the only job in the game whose work gets counted.
- **Drivers and storemen** get twenty each. A logistics problem is a load and
  a schedule: stopping is dangerous and going on is dangerous, and half of it
  is deciding which company doesn't get the ammunition.
- **All seven special units** get twenty each — including the three you get
  *promoted into*, which had none at all, so reaching the top of the pack used
  to make your war shallower than the unit you left.

And you won't get the same scene twice in a row any more.

## Combat asks you something at every step

An engagement runs over several beats, and four out of five used to be text
with a "go on" button. Each step now asks its own question — the first seconds
of contact, whether to act on a half-formed picture, what you do about what
just happened, who you go for, and what you put in the report.

## The after-action report actually reports

It was never showing the men you lost — it only counted a death if *you* were
the one who died. It now names your casualties, and a man hit and killed in
the same action is one casualty, not two. Reports are also no longer all filed
exactly eleven days later.

---

## Fixes

- **Paying a loan said "there is nothing to pay it with" when you had the
  money.** If you were married, the game was checking the wrong account.
- **The feed reported one death three times.** Two different systems were both
  narrating your squadmates. It also told it backwards — you'd read that he was
  killed before reading that you called the evacuation in.
- **Getting sick marked you WIA and left you "on the line".** Dysentery is not
  a combat wound, and a man with a fever is not on the line.
- **A first sergeant was still called MSG** everywhere — the roster, the
  report, the newspaper.
- **Border clashes crowded out your life story.** Only actual declarations of
  war reach the feed now; everything else lives on the News tab.
- **Nothing could ever come for a company you floated.** The yearly rival could
  pick your own spouse, spending your own savings, which also blocked any real
  rival for good.
- **Veterans built service disability from civilian accidents** — falling off a
  ladder counted as a war injury and paid a pension for it.
- **A dead officeholder kept their seat** for a month. The chair is empty from
  the day they die, and a by-election follows.
- Assorted: muggings no longer produce shrapnel wounds; squadmates' deployments
  show on their own records.
