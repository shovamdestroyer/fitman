# 🧘 FitAI Coach — AI Yoga, Fitness & Nutrition Platform

FitAI Coach is an all-in-one, mobile-first AI fitness and wellness application that combines **live browser camera yoga pose detection**, **7-day personalized workout planning**, **Mifflin-St Jeor nutrition & calorie calculations**, **Indian meal logging**, **daily hydration tracking**, and **SATHI AI companion** (your 24/7 fitness & dietitian chatbot).

---

## ⚡ Highlights & Key Features

- **🧘 Real-Time AI Yoga Tracking**:
  - Live in-browser pose estimation powered by **MediaPipe Pose Landmarker**.
  - Calculates real joint angles (shoulders, elbows, hips, knees) using vector trigonometry and cosine laws.
  - Camera access requested **only** when the user starts a session.
  - Real-time voice and audio synthesis guidance with confidence-aware posture feedback.
  - **40 Authentic Yoga Poses** with Sanskrit names, categories, benefits, safety notes, and alignment rules (e.g. *Tadasana, Vrikshasana, Trikonasana, Virabhadrasana I & II, Bhujangasana, Malasana, Ustrasana, Surya Namaskar*).
- **💪 7-Day Personalized Workout Planner**:
  - Exactly **5 structured activities per day** with instructions, sets, reps, durations, difficulty ratings, target muscle groups, estimated calorie burn, and substitutions.
  - Includes daily warmup routines and cooldown stretches.
  - Session completion tracking and interactive workout summary modals.
  - **20+ Fitness Exercises** covering strength, hypertrophy, and aerobic conditioning (push-ups, squats, lunges, planks, glute bridges, mountain climbers, burpees, calf raises).
- **🔥 Scientific Calorie & Macro Engine**:
  - Validated **Mifflin-St Jeor formula** for Basal Metabolic Rate (BMR) with gender adjustments.
  - Total Daily Energy Expenditure (TDEE) based on activity levels (sedentary, light, moderate, very active, extra active).
  - Target calorie calculations with clinical safety thresholds (minimum 1,200 kcal for females, 1,500 kcal for males, minor safety warnings).
  - Dynamic macronutrient targets (Protein, Carbohydrates, Fats) customized to fitness goals (fat loss, muscle gain, maintenance, mobility).
  - Body Mass Index (BMI) assessment with epidemiological context notes.
- **🥗 Indian Nutrition Database & Food Logger**:
  - Curated database of authentic Indian foods with accurate macro breakdowns: *Roti (Phulka), cooked white/brown rice, Moong dal, Toor dal, Rajma, Kabuli Chana, Low-fat & regular Paneer, Tofu, Poha, Idli-Sambar, Dosa, Soya chunks, Palak, Curd (Dahi), Boiled eggs, Grilled chicken/fish, Makhana*.
  - Portion multipliers (0.5x, 1x, 1.5x, 2x, 3x) and real-time total calculation.
  - Dietary filter support: Vegetarian, Vegan, Eggetarian, Non-Vegetarian.
  - Daily food logging with persistent history stored in `localStorage`.
- **💧 Daily Hydration Tracker**:
  - Dynamic water intake goal (35 ml per kg body weight baseline).
  - Animated hydration ring with percentage progress.
  - Quick-add buttons (+250 ml, +500 ml) with time-stamped history and undo functionality.
  - Browser notification reminder support.
- **✨ SATHI AI Companion (Dietitian & Fitness Chatbot)**:
  - 3 specialized modes: **Companion**, **Dietitian**, and **Fitness Coach**.
  - Connects to Google Gemini 2.5 Flash via secure backend (`/api/ai/chat`).
  - **Instant On-Device Fallback Engine**: If deployed statically on GitHub Pages or offline, SATHI automatically answers BMR/TDEE math, Indian food swaps, calorie deficits, yoga posture cues, and hydration targets without needing a server!
  - Built-in speech-to-text voice input.
- **🔒 Authentication & Privacy**:
  - Built-in Supabase Auth integration with local demo session fallback.
  - Instant one-tap Guest Demo mode with rich starter profile.
  - Zero hardcoded secrets or API keys in frontend code.
  - Camera feeds are processed strictly on-device; no video frames are recorded or transmitted to any server.

---

## 📂 Project Structure

```text
├── index.html            # Main web application entry point (GitHub Pages root)
├── style.css             # Main stylesheet bridge
├── script.js             # Client controller entry point
├── yoga.js               # Yoga module bridge
├── nutrition.js          # Nutrition module bridge
├── workouts.js           # Workout & exercise module bridge
├── auth.js               # Authentication module bridge
├── config.example.js     # Template for client-side Supabase credentials
├── manifest.json         # PWA Web App Manifest
├── service-worker.js     # Progressive Web App offline caching service worker
├── css/
│   ├── styles.css        # Core design system, glassmorphic dark theme, responsive grid
│   └── sathi.css         # SATHI AI companion animated orb and chat interface
├── js/
│   ├── app.js            # Main application router, screen manager & event handlers
│   ├── auth.js           # Supabase Auth client & profile management
│   ├── calories.js       # Mifflin-St Jeor calorie, BMR, TDEE, macro & BMI calculator
│   ├── chatbot.js        # SATHI AI chatbot (backend integration + on-device AI)
│   ├── dashboard.js      # Dashboard metrics, streak tracking, daily quotes & charts
│   ├── nutrition.js      # Indian food database, meal planner & food logging
│   ├── pose.js           # Live MediaPipe Pose estimation & trigonometry feedback
│   ├── water.js          # Daily hydration tracker & reminder logic
│   └── workouts.js       # 40 yoga poses, 20+ exercises & 7-day workout plans
├── database/
│   └── schema.sql        # Supabase PostgreSQL schema with Row Level Security (RLS)
├── server/
│   ├── server.js         # Node.js Express backend server
│   └── routes/
│       ├── ai.js         # Secure Gemini API chat endpoint
│       └── profile.js    # User profile database synchronization endpoint
├── package.json          # Node.js project metadata & dependencies
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore configuration
└── README.md             # Project documentation & GitHub Pages deployment guide
```

---

## 🚀 Running Locally

### Option 1: Full-Stack Mode with Backend (Recommended)
This mode runs the Node.js Express server to enable the Google Gemini AI proxy:

1. Install dependencies:
   ```bash
   npm install
   ```
2. (Optional) Copy `.env.example` to `.env` and add your `GEMINI_API_KEY`:
   ```bash
   copy .env.example .env
   ```
3. Start the server:
   ```bash
   npm run dev
   # or
   npm start
   ```
4. Open your browser at:
   ```
   http://localhost:3000
   ```

### Option 2: Static Mode (No Server Required)
You can directly open `index.html` in any modern web browser or use VS Code Live Server. All core fitness features (Camera Pose AI, 40 Yoga Poses, 7-Day Plans, Nutrition Math, Indian Food Logger, Hydration Tracker, and On-Device SATHI AI) work 100% in static mode!

---

## 🌐 Publishing to GitHub Pages (Step-by-Step)

### Why GitHub Pages Showed the Wrong Design Previously:
1. **Wrong Publishing Path**: In previous setups, files were located inside `public/` rather than the repository root. GitHub Pages only looks at `/ (root)` or `/docs`.
2. **Absolute URLs**: Old links used root-slashes (`/css/styles.css`, `/js/app.js`), which fail on repository subpaths like `https://username.github.io/fit-ai/`.
3. All asset paths are now **strictly relative** (`css/styles.css`, `js/app.js`), and `index.html` is at the repository root.

### Deployment Method A: Using GitHub Desktop
1. Open **GitHub Desktop**.
2. Click **File > Add Local Repository...** (or press `Ctrl + O`).
3. Select your project folder: `C:\Users\Admin\Desktop\sarvesh_mini`.
4. Enter commit message: `Fix and upgrade FitAI Coach for GitHub Pages`.
5. Click **Commit to main**, then click **Push origin** (or **Publish repository**).
6. Open your repository on [GitHub.com](https://github.com):
   - Navigate to **Settings** > **Pages** (in the left sidebar).
   - Under **Build and deployment > Source**, select **Deploy from a branch**.
   - Under **Branch**, select `main` and folder `/ (root)`.
   - Click **Save**.
7. In 1–2 minutes, your website will be live at:
   ```
   https://<your-username>.github.io/<repo-name>/
   ```

### Deployment Method B: Using Git Command Line
```bash
git add .
git commit -m "Deploy FitAI Coach to GitHub Pages"
git branch -M main
git push -u origin main
```
Then enable GitHub Pages under **Repository Settings > Pages** on branch `main` (`/ root`).

---

## ⚙️ Architecture: Static GitHub Pages vs. Node.js Backend

| Feature | Static GitHub Pages | Full Node.js Server (`server.js`) |
| :--- | :--- | :--- |
| **Live Camera Yoga Pose Estimation** | ✅ 100% On-Device (MediaPipe CDN) | ✅ 100% On-Device |
| **40 Yoga Poses & 20+ Exercises** | ✅ 100% Client-Side (`workouts.js`) | ✅ 100% Client-Side |
| **7-Day Personalized Workout Plan** | ✅ 100% Client-Side (`workouts.js`) | ✅ 100% Client-Side |
| **Mifflin-St Jeor Calorie & Macro Engine**| ✅ 100% Client-Side (`calories.js`) | ✅ 100% Client-Side |
| **Indian Food Database & Meal Logging** | ✅ 100% LocalStorage (`nutrition.js`) | ✅ LocalStorage + Server sync |
| **Daily Water Tracker & Reminders** | ✅ 100% LocalStorage (`water.js`) | ✅ LocalStorage + Server sync |
| **SATHI AI Companion Chatbot** | ✅ Instant On-Device AI Answers | ⚡ Live Google Gemini 2.5 Flash Proxy |
| **Authentication & Profiles** | ✅ Supabase Web SDK / Demo Session | ✅ Supabase Web SDK / Demo Session |

---

## 🔒 Security & Secrets

- **Zero Secrets in Repository**: No private API keys or database service keys are included in frontend code.
- **Server-Side Security**: If using the optional backend, `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` reside exclusively in `.env` on your backend server and are never exposed to the client.
