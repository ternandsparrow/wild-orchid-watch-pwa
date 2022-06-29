# Test cases for humans to run
This is pretty much what QA is.


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

---------------------------------------------------------

# Edit

## Edit local record

## Edit local (in progress) record

## Edit remote record

---------------------------------------------------------

# Delete

## Delete local record

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

# Comments

## comment on remote obs

## comment on remote obs with local edit

## assert comment on local-only record fails

## edit a comment

## delete a comment

---------------------------------------------------------

# Chaos monkey ideas
- very large photo
- attach video instead of photo
- HEIC photo
- lots of large photos (like 30 of them)
- lots of queued obs for upload
