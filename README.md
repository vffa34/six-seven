# Denari Coupon Manager (Web + Android)

Offline-first coupon system with admin login, barcode generation (000001-999999), unique denari sums, customer name, edit capability, used/unused marking, and camera barcode scanning.

## Website
Open `index.html` in a local static server:

```bash
python3 -m http.server 8080
```

Default admin credentials:

- username: `admin`
- password: `admin123`


Data is stored locally in browser storage for offline use.

## Android app
A native Android WebView wrapper lives in `android/` and packages the same offline web app in `app/src/main/assets/www`.

Build steps:

```bash
cd android
./gradlew assembleDebug
```

Install the APK from `android/app/build/outputs/apk/debug`.