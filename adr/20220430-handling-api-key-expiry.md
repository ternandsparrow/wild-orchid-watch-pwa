# Handling API key expiry

## Status
accepted

## Context
We use JWTs to make calls to the iNat API. These have 24hour expiry. In the old
approach (where we didn't run our own API facade) we included functionality to
[update the API
key](https://github.com/ternandsparrow/wild-orchid-watch-pwa/blob/master/sw-src/sw.js#L898)
on queued requests in the Service Worker. In the new system, where we *do* run
our own API facade, we no longer need this functionality.

We don't need it because:
1. the API facade will validate the auth token for all requests. If the token
   is valid, the request to upstream iNat will happen soon after (usually in
   seconds)
1. we assume requests sent to our facade API will be processed promptly
1. we assume iNat will have good uptime
1. we'll add a feedback loop to communicate failures from the facade. We're
   opting to "let things fail and retry" rather than try to save them.

## Decision
We will not build a mechanism to update API keys on queued requests.


## Consequences
Simpler code for us.

We have a [TOCTOU](https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use)
problem lurking. When this app sends a request to the facade, the facade will
check the token is valid. It's possible the token will then expire before it's
used for the request sent to upstream. This situation is unlikely, but still
possible. The situation becomes more likely if tasks sit in our facade queue
for long periods of time, for example when upstream iNat has an outage so our
requests fail.

We need to build a feedback loop so clients (this app) can know if a queued
request in the facade has failed terminally.
