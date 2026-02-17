# Permissions Justification

## `storage`
Used to save user preferences locally (language, Hijri correction, notification toggles, badge toggles, Ramadan debug override).

## `alarms`
Used to schedule periodic state refresh and prayer reminder timing.

## `notifications`
Used only when the user enables prayer reminders.

## Host permissions
None requested.

## Data/network model
No remote API calls and no external hosts. Prayer times are read from bundled local JSON.
