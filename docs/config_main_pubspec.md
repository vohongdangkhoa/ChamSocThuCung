# Config, main.dart va pubspec guide

Tai lieu nay ghi rieng cac file nen kiem tra khi app Flutter bi loi kho hieu:

- `lib/config/api_config.dart`
- `lib/main.dart`
- `pubspec.yaml`

Day la 3 diem hay gay loi vi chung anh huong toan app: API URL, Firebase init,
theme/home screen, dependencies va assets.

## 1. api_config.dart

File: `lib/config/api_config.dart`

Code hien tai:

```dart
class ApiConfig {
  static const String _configuredBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
  );

  static String get baseUrl {
    if (_configuredBaseUrl.isNotEmpty) {
      return _configuredBaseUrl;
    }

    if (kIsWeb) {
      return 'http://localhost:5200';
    }

    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://192.168.2.108:5200';
    }

    return 'http://localhost:5200';
  }
}
```

Y nghia:

- App uu tien URL tu bien build-time `API_BASE_URL`.
- Neu chay web thi mac dinh goi `http://localhost:5200`.
- Neu chay Android thi mac dinh goi `http://192.168.2.108:5200`.
- Platform khac dung `http://localhost:5200`.

Lenh chay co chi dinh API:

```powershell
flutter run --dart-define=API_BASE_URL=http://localhost:5200
```

Neu chay Android device that:

```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.2.108:5200
```

Neu chay Android emulator mac dinh, thu:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5200
```

Loi hay gap:

- Dung `localhost` tren dien thoai Android that: dien thoai se tro ve chinh no,
  khong phai may tinh dang chay backend.
- IP `192.168.2.108` doi khi doi khi doi mang Wi-Fi, reset router hoac doi may.
- Backend chay port khac `5200`.
- Firewall chan ket noi tu dien thoai vao may tinh.
- Backend dung HTTPS nhung app dang goi HTTP, hoac nguoc lai.

Khi nghi loi config:

1. Mo backend va xem port thuc te.
2. Tren browser may tinh thu `http://localhost:5200/swagger` neu backend co
   Swagger.
3. Tren dien thoai cung Wi-Fi, thu mo `http://<IP-may-tinh>:5200`.
4. Neu khong vao duoc, loi nam o backend/firewall/network, khong phai Flutter UI.
5. Chay app voi `--dart-define=API_BASE_URL=...` de test nhanh khong can sua
   file.

## 2. main.dart

File: `lib/main.dart`

Vai tro:

- Khoi dong Flutter binding.
- Khoi tao Firebase.
- Chay `PetNoVaApp`.
- Tao `MaterialApp`.
- Gan theme app.
- Dat `SplashScreen` lam man dau tien.

Luong hien tai:

```text
main()
  -> WidgetsFlutterBinding.ensureInitialized()
  -> Firebase.initializeApp(DefaultFirebaseOptions.currentPlatform)
  -> runApp(PetNoVaApp)
  -> MaterialApp
  -> SplashScreen
```

Nhung import quan trong:

- `firebase_core`
- `flutter/material.dart`
- `firebase_options.dart`
- `screens/splash_screen.dart`
- `theme/app_theme.dart`

Loi hay gap:

- Xoa/mat `firebase_options.dart`: app loi ngay luc khoi dong Firebase.
- Chua configure Firebase cho platform dang chay: loi
  `DefaultFirebaseOptions have not been configured`.
- Goi Firebase truoc `WidgetsFlutterBinding.ensureInitialized()`.
- Doi `home` sang screen khac lam mat luong check login/role.
- Loi trong `SplashScreen` co the nhin nhu loi `main.dart` vi app mo len la vao
  Splash dau tien.

Khi app bi loi ngay luc mo:

1. Kiem tra terminal co stack trace Firebase khong.
2. Kiem tra `firebase_options.dart` co platform dang chay khong.
3. Kiem tra `DefaultFirebaseOptions.currentPlatform`.
4. Kiem tra `SplashScreen.checkLogin()` neu app khoi dong xong roi vang ve login.
5. Tam thoi co the doi `home` sang mot screen don gian de tach loi Firebase/UI,
   nhung sau do phai tra lai `SplashScreen`.

## 3. pubspec.yaml

File: `pubspec.yaml`

Vai tro:

- Khai bao ten app, version, SDK.
- Khai bao dependencies.
- Khai bao assets.
- Khai bao launcher icon config.

Thong tin hien tai:

```yaml
name: petnova_app
version: 1.0.0+1

environment:
  sdk: ^3.12.0

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.8
  firebase_core: ^4.10.0
  firebase_auth: ^6.5.2
  http: ^1.6.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^6.0.0
  flutter_launcher_icons: ^0.14.3

flutter:
  uses-material-design: true
  assets:
    - assets/images/

flutter_launcher_icons:
  android: true
  ios: true
  image_path: "assets/images/petnova_icon.png"
```

Loi hay gap:

- Sua indentation YAML sai: Flutter khong doc duoc pubspec.
- Them asset nhung quen khai bao trong `assets`.
- Doi path icon nhung file khong ton tai.
- Update dependency nhung chua chay `flutter pub get`.
- Version package qua moi/cu so voi Flutter SDK dang cai.
- `pubspec.lock` lech dependency sau khi doi `pubspec.yaml`.

Lenh nen chay sau khi sua `pubspec.yaml`:

```powershell
flutter pub get
```

Kiem tra loi dependency:

```powershell
flutter analyze
```

Kiem tra test nhanh:

```powershell
flutter test
```

## 4. Quan he giua 3 file nay

`pubspec.yaml` quyet dinh package nao co trong app.

`main.dart` import va dung package do, vi du `firebase_core`.

`api_config.dart` khong khoi dong app, nhung tat ca service can no de goi
backend.

Neu app loi:

- Loi dependency/import: xem `pubspec.yaml`.
- Loi Firebase khi mo app: xem `main.dart` va `firebase_options.dart`.
- Loi khong load du lieu/backend: xem `api_config.dart` va service.
- Loi role/dieu huong sau login: xem `SplashScreen` va `LoginScreen`.

## 5. Checklist sua loi nhanh

1. Chay `flutter pub get`.
2. Chay `flutter analyze`.
3. Chay `flutter test`.
4. Kiem tra backend co chay khong.
5. Kiem tra URL trong `ApiConfig.baseUrl`.
6. Kiem tra Firebase project/options.
7. Kiem tra endpoint service dang goi co dung backend khong.
8. Kiem tra model `fromJson` co khop response khong.
9. Xem Git file nao dang `M` de biet minh vua sua gi.

## 6. Ghi chu rieng cho PetNoVa hien tai

- `api_config.dart` dang hard-code Android IP `192.168.2.108`; neu mang doi,
  Android se loi API.
- `main.dart` dang dung `SplashScreen` la dung voi luong role hien tai.
- `pubspec.yaml` da khai bao `assets/images/`, nen icon PetNoVa trong folder do
  co the load duoc.
- Test hien tai con rat nhe, moi kiem tra tao duoc `PetNoVaApp`.
- Khi sua UI theo Figma, neu them font/asset moi thi phai quay lai sua
  `pubspec.yaml`.
