# Creating the tracker document (`trackers/main`)

FiveUp reads one document, `trackers/main`, to decide who can use the app and how points work.
Clients can't write it (security rules), so create it once in the Firebase console.

> No secrets are involved — this is just a Firestore document with two email addresses.

## Steps

1. Open the [Firebase console](https://console.firebase.google.com/) → your project →
   **Build → Firestore Database**. If Firestore isn't created yet, click **Create database**
   (production mode, pick a region close to you, e.g. `australia-southeast1`).
2. Click **+ Start collection**, Collection ID: `trackers`.
3. Document ID: `main` (must match `VITE_TRACKER_ID`, default `main`).
4. Add these fields:

| Field          | Type   | Value                                                 |
| -------------- | ------ | ----------------------------------------------------- |
| `name`         | string | `FiveUp`                                              |
| `writerName`   | string | The tracker's first name, e.g. `Mia` (optional)       |
| `writerEmail`  | string | The tracker's Google email, **all lowercase**         |
| `viewerEmails` | array  | One string item: the viewer's Google email, lowercase |
| `settings`     | map    | See below                                             |

`settings` map fields (all **number** except `timezone`):

| Field                | Type   | Value              |
| -------------------- | ------ | ------------------ |
| `mealPoints`         | number | `10`               |
| `snackPoints`        | number | `3`                |
| `snackCap`           | number | `3`                |
| `fullDayBonus`       | number | `10`               |
| `streakBonus`        | number | `5`                |
| `streakBonusMinDays` | number | `3`                |
| `timezone`           | string | `Pacific/Auckland` |

5. Click **Save**.

## Notes

- **Emails must match the Google account exactly.** The security rules compare the signed-in
  email with `writerEmail` / `viewerEmails` character for character, so store them in lowercase
  (Google account emails are lowercase).
- **Missing settings fall back to the defaults** in `src/lib/defaultSettings.ts`, so `settings` can
  be partial. An invalid `timezone` also falls back to `Pacific/Auckland`.
- `timezone` is an [IANA name](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
  (e.g. `Pacific/Auckland`), never an offset like `+13:00`. It decides what "today" is for both
  users.
- To add or change a viewer later, edit `viewerEmails` here. Changes apply live.
- The same document as JSON, for reference:

```json
{
  "name": "FiveUp",
  "writerName": "Mia",
  "writerEmail": "tracker@gmail.com",
  "viewerEmails": ["viewer@gmail.com"],
  "settings": {
    "mealPoints": 10,
    "snackPoints": 3,
    "snackCap": 3,
    "fullDayBonus": 10,
    "streakBonus": 5,
    "streakBonusMinDays": 3,
    "timezone": "Pacific/Auckland"
  }
}
```
