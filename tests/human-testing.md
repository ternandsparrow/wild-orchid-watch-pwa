# Test cases for humans to run
This is pretty much what QA is.

Be sure to run the tests on various devices/browsers, e.g:
- iOS (all browsers are Safari under the covers)
- Android Chromium
- Android Firefox
- Android Samsung Internet
- macOS Safari
- macOS/Windows/Linux Chromium/Firefox/Edge


## Login
- open a clean browser window (private/incognito will do)
- open the app URL
- *expected*: the onboard screen is visible
- go through the onboarder
- login via iNat
- *expected*: you return to the WOW app and see your observations list, which is empty

---------------------------------------------------------

# Create new obs

## speed run, no EXIF
- open app and login
- click the (+) button to create a new obs
- add the 3 mandatory photos using photos with no EXIF
- give a species name
- *expected*: the app should prompt you to enter datetime and coords as the
  photos didn't contain that data
- select an Orchid Type
- press save
- *expected*: the observation saves successfully (no error messages)
- *expected*: you're redirected to the detail view of the observation
- navigate back to My Observations
- *expected*: the new observations shows at the top of the list, has a
  placeholder thumbnail (grey leaf?) and is shown as "being processed"
- wait 40 seconds
- *expected*: the facade has uploaded your obs to iNat, the check in the app
  has fired and seen the finished upload and replaced the obs in the list with
  the remote item.
- *expected*: (programmers only) the local obs data has been removed from indexeddb
- click the new obs item
- *expected*: the URL contains the remote iNat ID (an integer), not the UUID

## With EXIF
- open app and login
- click the (+) button to create a new obs
- add the 3 mandatory photos using photos *with* EXIF data (coords too)
- give a species name
- *expected*: the datetime and coords should be read from the first uploaded
  photo
- select an Orchid Type
- press save
- *expected*: the observation saves successfully (no error messages)
- *expected*: you're redirected to the detail view of the observation
- navigate back to My Observations
- *expected*: the new observations shows at the top of the list, has a
  thumbnail and is shown as "being processed"
- wait 40 seconds
- *expected*: the facade has uploaded your obs to iNat, the check in the app
  has fired and seen the finished upload and replaced the obs in the list with
  the remote item.
- *expected*: (programmers only) the local obs data has been removed from indexeddb
- click the new obs item
- *expected*: the URL contains the remote iNat ID (an integer), not the UUID

## Detailed mode
- open app and login
- click the (+) button to create a new obs
- scroll to the very bottom of the page
- use the slider to enable Detailed Mode
- *expected*: the view is updated and all observation fields are shown
- continue testing as in the "With EXIF" case
- be sure to provide values for all inputs
- *expected*: once uploaded, confirm all the fields have the values you provided

## Offline
- disconnect your device from any network, go fully offline
- tap the button to create a new observation
- *expected*: the page should load to create new obs, you should *not* get an
  error about not being able to load project info. That should already be
  cached.
- try to create an observation as per any of above
- *expected*: the observation won't be uploaded, but there should be no error
- reconnect to the network
- *expected*: within a few minutes, the observation should be uploaded

---------------------------------------------------------

# Edit

## Edit local record

## Edit local (in progress) record

## Edit remote record

## Offline edit remote
- disconnect your device from any network, go fully offline
- try to edit a remote observation
- the edit won't be uploaded, but there should be no error
- reconnect to the network
- within a few minutes, the observation should be uploaded

## Offline edit local
- disconnect your device from any network, go fully offline
- create an observation, save it
- edit that new, local observation
- the observation won't be uploaded, but there should be no error
- reconnect to the network
- within a few minutes, the observation should be uploaded

---------------------------------------------------------

# Delete

## Delete local record
Note: this is a hard one to test. You probably want to be a developer running,
the stack locally so you can control when the callback runs.

- reduce status check frequency to give you more time, set this in `.env.local`
    ```
    VUE_APP_TASK_CHECK_FREQ=120
    ```
- (re)start the PWA dev server
- create new obs
- prep "create callback" and "delete callback" curl commands
    ```
    http POST http://localhost:3000/task-callback/${uuid} authorization:blah
    http DELETE http://localhost:3000/task-callback/${uuid} authorization:blah
    ```
- wait for status check to run, note you have 120 seconds to complete the next steps
- run "create callback" curl command
- *expected*: should see inatId is set in `uploads` table in facade
- use PWA to delete the obs
- run "delete callback" curl command
- *expected*: facade should find inatId using "lookback"
- *expected*: facade should send delete request to iNat
- wait for status check in PWA
- *expected*: status check shows complete, local record is removed, task is
  deleted, record is spliced from "allRemoteObs" array
- refresh the obs list in PWA
- *expected*: the obs doesn't come back, it *is* deleted on iNat too


## Delete local (in progress) record

## Delete remote record

---------------------------------------------------------

# Coords

## Manual decimal coords
- open app and login
- click the (+) button to create a new obs
- scroll to the bottom of the page
- enable "Detailed Mode"
- scroll back up the "Geolocation" section

### Radio group is selected
- click in either of the input field
- *expected*: the radio group (the dot to the left of the choices) for
  "Manually enter decimal GPS coordinates" should be automatically selected

### Not a number input
- input lat=`123` and lon=`abc`
- *expected*: a warning is shown to indicate invalid input

### Valid decimals in Australia
- input lat=`-33.123` and lon=`150.456`
- *expected*: the values are valid

### Valid decimals outside Australia
- input lat that is [less than
  -55](https://github.com/ternandsparrow/wild-orchid-watch-pwa/blob/55af7f60afa3080eb2fef3dea95f97e85961223e/src/misc/constants.js#L350)
  or [greater than
  -10](https://github.com/ternandsparrow/wild-orchid-watch-pwa/blob/55af7f60afa3080eb2fef3dea95f97e85961223e/src/misc/constants.js#L354)
  and lon that is [less than
  105](https://github.com/ternandsparrow/wild-orchid-watch-pwa/blob/55af7f60afa3080eb2fef3dea95f97e85961223e/src/misc/constants.js#L366)
  or [greater than
  168](https://github.com/ternandsparrow/wild-orchid-watch-pwa/blob/55af7f60afa3080eb2fef3dea95f97e85961223e/src/misc/constants.js#L370)
- *expected*: you get a warning saying the values are outside of Australia

### Valid integers
- input lat=`-33` and lon=`150`
- *expected*: the values are valid
- fill out the rest of the observation
- save
- *expected*: the coords are saved successfully and show in the observation details page (on the map tab)

## Drop pin on map coords

### Moving map updates coordinates

### Coords are correctly saved

### Map shows correct coordinate when editing record

### Swapping between coord input methods works

---------------------------------------------------------

# Photos

## edit with no new photos

## edit with 1 new photo

## edit with >1 new photos

---------------------------------------------------------

# Comments

## comment on remote obs

## comment on remote obs with local edit

## assert commenting fail for a record that hasn't hit iNat yet

## edit a comment

## delete a comment

---------------------------------------------------------

# Chaos monkey ideas
- very large photo
- attach video instead of photo
- HEIC photo
- lots of large photos (like 30 of them)
- lots of queued obs for upload
