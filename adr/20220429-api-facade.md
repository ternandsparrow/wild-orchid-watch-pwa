# API facade

## Status
accepted

## Context
If the first release of this app, we directly contacted the iNat API for all
operations. This was good because it means this project has minimal operational
costs (no servers to run) and the iNat team has resources to operate the
services this app relies on.

That approach proved troublesome because of
- the design of the iNat API: it requires separate requests for photos and
  observation data, and
- the way Service Workers operate on mobile devices

The challenges were
- only some requests would be processed before the browser stopped background
  processed (for power management reasons). This confused users because they
  could see the record in their app but no on iNat.
- unless the user opened this app up again, the rest of the requests would
  never be processed
- the logic to coordinate these multiple requests is complex. It's not possible
  to test on all target platforms and trying to decipher error reports from
  remote devices can be hard.

## Decision
Build our own API Facade that sits in front of the iNat API. The API exposes an
endpoint that accepts all data in a single requests (multi-part form request)
so only a single request is needed by the client to create/edit an observation.

## Consequences
The assumption is that a browser will *not* kill a service worker that has an
in-flight request; it will wait for that request to complete before stopping
it. This is why we make sure we only need to send a single request so the
operation is atomic.

If the request is successfully sent to the Facade, chances are good that
sending to upstream will also work.

This project will now have to operate a server to run the Facade.

Logic in this app can be significantly simplified because:
- logic (complexity) around sending the separate requests to iNat are handling
  in the Facade now
- the facade is a controlled environment (unlike targeting all browsers) so
  it's easier to maintain code for
- devs have access to the Facade to aid in debugging issues
- the same request is made with/without a Service Worker running, so we can use
  vanilla Workbox
