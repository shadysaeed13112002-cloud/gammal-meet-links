# Gammal Meet Links

صفحة ويب بسيطة بتعمل سيشن على Google Calendar مدتها ساعة ومعاها لينك Google Meet، على حساب جوجل اللي إنت داخل بيه، وبعدها بتجهزلك رسالة (اسم السيشن + اللينك) تنسخها وتبعتها على واتساب.

- سيشن **مرة واحدة**: بتختار التاريخ والوقت.
- سيشن **أسبوعية**: بتختار الأيام وكل يوم بوقته وعدد الأسابيع. الطالب بياخد لينك واحد ثابت حتى لو الأوقات مختلفة من يوم ليوم.
- التوقيت على القاهرة (`Africa/Cairo`). لو عايز تغيّر سيشن واحدة بس، عدّلها من Google Calendar على طول.

---

## للانستراكتور: إزاي تشغّلها

1. ابعت إيميل الـ Gmail بتاعك لشادي عشان يضيفك (مرة واحدة بس).
2. نزّل الفولدر ده وفكّه (لو zip).
3. اتأكد إن Python متسطب:
   - **ماك**: موجود جاهز.
   - **ويندوز**: نزّله من [python.org](https://www.python.org/downloads/) وعلّم على **Add python.exe to PATH** وإنت بتسطب.
4. شغّل:
   - **ويندوز**: دبل كليك على `start.bat`
   - **ماك**: دبل كليك على `start.command` (أول مرة: كليك يمين ← Open)
   - **لينكس**: `./start.sh`
5. الصفحة هتفتح على `http://localhost:8080`. اضغط **Sign in with Google** واختار حسابك.
6. أول مرة هيظهرلك "Google hasn't verified this app". اضغط **Continue** (ده طبيعي لأن الأداة داخلية) ووافق على صلاحية الكالندر.

> ماتفتحش `index.html` بدبل كليك. جوجل مش بيسمح بتسجيل الدخول غير من `localhost`، فلازم تفتحها من ملف `start`.

---

## للأدمن (شادي): إعداد Google Cloud مرة واحدة

1. ادخل [Google Cloud Console](https://console.cloud.google.com/) واعمل Project جديد، مثلاً `gammal-meet-links`.
2. **APIs & Services ← Library**: دوّر على **Google Calendar API** واعمل **Enable**.
3. **APIs & Services ← OAuth consent screen** (أو **Google Auth Platform**):
   - User type: **External**.
   - App name: `Gammal Meet Links`، وحط إيميلك في support وdeveloper contact.
   - **Data access / Scopes**: ضيف `https://www.googleapis.com/auth/calendar.events`.
   - **Audience / Test users**: ضيف إيميل Gmail بتاع كل انستراكتور (لحد 100). خلي الـ Publishing status على **Testing**.
4. **APIs & Services ← Credentials ← Create credentials ← OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: `http://localhost:8080`
   - مش محتاج Redirect URIs.
5. انسخ الـ **Client ID** وحطه في `config.js` مكان `PASTE_YOUR_CLIENT_ID_HERE...`.

الـ Client ID مش سر، عادي يبقى جوه الكود اللي بتشاركه. ماتشاركش الـ Client secret (الأداة مش بتستخدمه أصلاً).

لما انستراكتور جديد ينضم: ضيف إيميله في **Test users**، وابعتله الفولدر.

---

## تفاصيل تقنية

- HTML + JavaScript عادي، من غير build ولا سيرفر غير `python -m http.server`.
- تسجيل الدخول بـ Google Identity Services (token client)، والصلاحية `calendar.events` بس. التوكن بيتحفظ في الـ tab لحد ما تقفله ومفيش أي داتا بتطلع برة جهازك غير لجوجل.
- اللينك بيتعمل بـ `conferenceData.createRequest` (`hangoutsMeet`). المواعيد الأسبوعية اللي بنفس الوقت بتبقى سلسلة واحدة (`RRULE:FREQ=WEEKLY;BYDAY=...`)، والأوقات المختلفة بتبقى سلاسل منفصلة بتشارك نفس الـ conference.
- آخر 20 سيشن بيتحفظوا في المتصفح عشان تنسخ اللينك تاني.
- اختبارات الحسابات: `node --test tests/helpers.test.js`
