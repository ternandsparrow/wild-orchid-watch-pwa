Thanks [Andy Wright](https://github.com/losandes) for the introduction to ADRs.
These are his words.

# Architectural Decision Records

This project uses Architectural Decision Records (ADRs) to document decisions
about the archicture, conventions, etc. Consider writing an ADR to produce
context to help developers understand why a thing is the way it is, and to keep
track of technical debt, and progress against it.

You can [read more about ADRs
here](https://github.com/joelparkerhenderson/architecture_decision_record).
This project uses [Michael Nygard's template for
ADRs](https://github.com/joelparkerhenderson/architecture_decision_record/blob/master/adr_template_by_michael_nygard.md).

To make it easier to discover decisions that override previous decisions, ADR
records will follow a convention similar to naming database migrations:

> _yyyyMMdd-[description].md_

##### This tweet by Cindy Alvarez @cindyalvarez seems relevant in this context too

    Every time I make myself write out

    We are doing _____
    Because we see the problem of _____
    We know it's a problem because _____
    If we don't fix it, we'll see _____
    We'll know we've fixed it when we get _____

    the rest of the conversation/project/doc goes SO much easier.

### How can we approach making the decisions that will be documented in ADRs?

> There are several questions I repeatedly ask myself, and that are found in ADR
> templates to help us answer, "how". A technique we might consider when doing
> research to inform our decisions is [Value
> Modeling](https://www.nytimes.com/2018/09/01/opinion/sunday/how-make-big-decision.html).
> Scenario Planning is another technique discussed in that same article, that can
> be useful in this context.<br />-- Andy Wright

#### Why

* Why do we need to make this decision, or what problem does it solve? (if it
  isn't obvious - i.e. we know why we need to choose a language).
* If we're solving a problem, how do we know it's a problem: how did/can we
  identify it, and what causes it?

#### What: decision

* What is the decision, or design that we settled on
* If appropriate, what are the behaviors, identifiers, or outcomes that will
  help us verify that we followed, are following, or completed this decision.

#### What: qualification

(Value Modeling is helpful here)

* What are the inputs to this decision? (i.e. what did we witness to help
  identify the need for a decision)
* What are the artifacts that informed this decision? (i.e. what solutions,
  libraries, or products did we consider; what values did we compare solutions
  against)
  * i.e. Topical values that informed our decision:
    * Does the decision offer our organization a competitive advantage?
    * What are the operating expenses (OPEX) associated with a given decision
      (free libs, vs. SASS)?
    * What are the capital expenses (CAPEX) associated with a given decision
      (the amount of effort (`people * time`) required to implement the
      solution)
    * How familiar is the team with the declarative knowledge (i.e. the
      technologies), and procedural knowledge (i.e. how, and when to use them)
      associated with a given decision?
  * Weights for each value (assuming not all values are created equal)
  * The scores each solution was given for each value, and why
* What are the constraints that impact this decision?
  * Should those constraints be recognized continually? (i.e. regulatory, or
    enterprise compliance; patent infringement)
  * Should those constraints be recognized until some event occurs? (i.e.
    another feature is completed; a change in policy is enforced)
  * Do those constraints represent technical debt that should be paid down as
    soon as possible? (i.e. we had to ship in 2 days, something that should
    take 2 weeks; or this can't be finished until xyz happen)?

#### What if: quantification & consequences

(Scenario Planning is helpful here)

* What are the consequences of **not** making this decision? What are the
  consequences of making a different decision (i.e. one of the other options
  discussed)?
* What are the consequences of making _this_ decision?
  * Think about what consequences will matter to future readers. This should
    certainly include technical consequences, but political consequences might
    also be in scope if we feel safe including them: does this represent a pain
    point, or sunk cost that could result in emotionally, or strategically
    charged reactions to change.
* What are the consequences of making this decision, and then changing the
  decision later (does it back us into a corner)?
* What are the consequences if the design doesn't work (does it carry risk;
  should/did we perform Failure Modes, and Effect Analysis (FMEA))?

#### Who

* Who solicited this decision, or is affected by the problem?
* Who is impacted by this decision (if different)?
* Who, if anyone, should be consulted before accepting, or overriding this
  decision (i.e. person, people, team, community, agency, etc.)

#### When

* When do we intend to implement this decision

