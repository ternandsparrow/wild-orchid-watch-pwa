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

## Drop pin on map coords

---------------------------------------------------------

# Chaos monkey ideas
- very large photo
- attach video instead of photo
- HEIC photo
- lots of large photos (like 30 of them)
- lots of queued obs for upload
