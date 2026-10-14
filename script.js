// FitAI Coach & SATHI AI — Unified Application Script
if (typeof window.FITAI_APP_LOADED === "undefined") {
  window.FITAI_APP_LOADED = true;

// ========================================================
// MODULE: js/auth.js
// ========================================================
// public/js/auth.js
// Authentication & Profile Manager with Supabase Auth & Local Session Fallback

const Auth = (() => {
  const SESSION_KEY = 'fitai_auth_session';
  const PROFILE_KEY = 'fitai_user_profile';
  let supabaseClient = null;

  // Initialize Supabase if credentials exist
  function initSupabase() {
    const url = window.SUPABASE_URL || localStorage.getItem('supabase_url');
    const key = window.SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key');
    if (url && key && window.supabase) {
      try {
        supabaseClient = window.supabase.createClient(url, key);
        console.log('⚡ Supabase Client initialized successfully.');
      } catch (e) {
        console.warn('Supabase client init failed:', e);
      }
    }
  }

  // Get current active session
  function getSession() {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function isAuthenticated() {
    const s = getSession();
    return Boolean(s && s.user && s.token);
  }

  function getCurrentUser() {
    const s = getSession();
    return s ? s.user : null;
  }

  function getAuthToken() {
    const s = getSession();
    return s ? s.token : null;
  }

  // Sign Up
  async function signUp(email, password, name) {
    if (!email || !password) throw new Error('Email and password are required.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');

    if (supabaseClient) {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { name: name || 'Athlete' } }
      });
      if (error) throw error;
      const session = {
        user: { id: data.user.id, email: data.user.email, name: name || 'Athlete' },
        token: data.session ? data.session.access_token : 'sb-auth-' + Date.now()
      };
      saveSession(session);
      return session;
    }

    // Local / Demo Authenticated Registration
    const user = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      email: email.trim().toLowerCase(),
      name: name || email.split('@')[0],
      createdAt: new Date().toISOString()
    };
    const session = {
      user,
      token: 'jwt_token_' + btoa(user.id + ':' + user.email)
    };
    saveSession(session);
    return session;
  }

  // Sign In
  async function signIn(email, password) {
    if (!email || !password) throw new Error('Please enter both email and password.');

    if (supabaseClient) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const session = {
        user: { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || 'Athlete' },
        token: data.session.access_token
      };
      saveSession(session);
      return session;
    }

    // Local Verification (or guest check)
    const user = {
      id: 'usr_' + btoa(email.trim().toLowerCase()).substr(0, 10),
      email: email.trim().toLowerCase(),
      name: email.split('@')[0],
      isGuest: false
    };
    const session = {
      user,
      token: 'token_' + btoa(user.id)
    };
    saveSession(session);
    return session;
  }

  // Instant Guest / Demo Mode
  function startGuestDemoSession() {
    const user = {
      id: 'guest-user-demo',
      email: 'demo@fitaicoach.app',
      name: 'Alex Rivera',
      isGuest: true
    };
    const session = {
      user,
      token: 'guest-demo-token'
    };
    saveSession(session);

    // Provide rich starter profile
    const demoProfile = {
      id: user.id,
      name: 'Alex Rivera',
      age: 26,
      sex: 'male',
      height: 178,
      weight: 74,
      target_weight: 70,
      unit_preference: 'metric',
      fitness_goal: 'fat_loss',
      activity_level: 'moderate',
      yoga_experience: 'intermediate',
      workout_experience: 'intermediate',
      dietary_preference: 'vegetarian',
      allergies: [],
      equipment: ['bodyweight', 'yoga_mat', 'dumbbells'],
      daily_duration: 35,
      health_limitations: 'Mild lower back stiffness in morning',
      onboardingComplete: true
    };
    saveProfile(demoProfile);
    return session;
  }

  // Sign Out
  async function signOut() {
    if (supabaseClient) {
      try { await supabaseClient.auth.signOut(); } catch (e) {}
    }
    localStorage.removeItem(SESSION_KEY);
    window.location.hash = '#auth';
  }

  // Reset Password
  async function resetPassword(email) {
    if (!email) throw new Error('Please enter your registered email.');
    if (supabaseClient) {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return true;
    }
    // Simulated reset link for demo mode
    return true;
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  // Profile Management
  function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    // Trigger sync to server
    syncProfileToServer(profile);
  }

  function loadProfile() {
    try {
      const data = localStorage.getItem(PROFILE_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return null;
  }

  async function syncProfileToServer(profile) {
    const token = getAuthToken();
    if (!token) return;
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });
    } catch (e) {
      console.warn('Profile background sync pending offline:', e);
    }
  }

  // Auto initialize on load
  initSupabase();

  return {
    signUp,
    signIn,
    signOut,
    resetPassword,
    startGuestDemoSession,
    isAuthenticated,
    getCurrentUser,
    getAuthToken,
    saveProfile,
    loadProfile
  };
})();


// ========================================================
// MODULE: js/calories.js
// ========================================================
// public/js/calories.js
// Deterministic, clinically validated Calorie, BMR, TDEE, Macro & BMI Calculator

const Calories = (() => {
  // Activity Level Multipliers
  const ACTIVITY_MULTIPLIERS = {
    sedentary: 1.2,        // Desk job, little/no exercise
    light: 1.375,          // Light exercise 1-3 days/week
    moderate: 1.55,        // Moderate exercise 3-5 days/week
    very_active: 1.725,    // Intense exercise 6-7 days/week
    extra_active: 1.9      // Heavy manual labor or twice-a-day training
  };

  // 1. Calculate Basal Metabolic Rate using Mifflin-St Jeor Equation
  function calculateBMR(weightKg, heightCm, age, sex = 'male') {
    if (!weightKg || !heightCm || !age) return 0;
    const base = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
    
    if (sex === 'male') {
      return Math.round(base + 5);
    } else if (sex === 'female') {
      return Math.round(base - 161);
    } else {
      // Neutral / Prefer not to say: Arithmetic midpoint
      return Math.round(base - 78);
    }
  }

  // 2. Calculate Total Daily Energy Expenditure (TDEE)
  function calculateTDEE(bmr, activityLevel = 'moderate') {
    const mult = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
    return Math.round(bmr * mult);
  }

  // 3. Calculate Target Calories & Safeguards based on Fitness Goal
  function calculateTargets(tdee, goal = 'fat_loss', sex = 'male', age = 25) {
    let targetCalories = tdee;
    let deficitOrSurplus = 0;
    let description = 'Maintenance calorie balance to sustain body composition and energy levels.';

    // Safeguard thresholds (ACSM / Dietetic Guidelines)
    const minCalories = (sex === 'female') ? 1200 : 1500;

    switch (goal) {
      case 'fat_loss':
        deficitOrSurplus = -450; // Conservative, sustainable deficit (~0.4 - 0.5 kg fat loss/week)
        targetCalories = Math.max(minCalories, tdee + deficitOrSurplus);
        description = `Targeting a moderate, sustainable caloric deficit of ~450 kcal/day for progressive fat loss while preserving lean tissue.`;
        break;
      case 'muscle_gain':
        deficitOrSurplus = +300; // Modest hypercaloric surplus for lean hypertrophic growth
        targetCalories = tdee + deficitOrSurplus;
        description = `Targeting a lean caloric surplus of ~300 kcal/day to facilitate muscle protein synthesis with minimal fat accumulation.`;
        break;
      case 'flexibility':
      case 'yoga':
      case 'general_fitness':
      case 'maintenance':
      default:
        deficitOrSurplus = 0;
        targetCalories = tdee;
        description = `Maintaining steady energy equilibrium for cellular repair, endurance, and yoga mobility.`;
        break;
    }

    const isMinor = age < 18;
    const advisory = isMinor
      ? 'Advisory: For individuals under 18, caloric restriction is not recommended without specialized pediatric or registered sports dietitian guidance.'
      : null;

    return {
      tdee,
      targetCalories,
      deficitOrSurplus,
      description,
      advisory
    };
  }

  // 4. Calculate Optimal Macronutrient Grams
  function calculateMacros(targetCalories, weightKg, goal = 'fat_loss') {
    if (!targetCalories || !weightKg) return { protein: 0, carbs: 0, fat: 0 };

    let proteinGramsPerKg = 1.8; // Standard sports nutrition guideline
    let fatPercentage = 0.25;    // 25% of energy from healthy fats

    if (goal === 'muscle_gain') {
      proteinGramsPerKg = 2.0;
      fatPercentage = 0.25;
    } else if (goal === 'fat_loss') {
      proteinGramsPerKg = 2.0;   // Higher protein for satiety and muscle sparing during deficit
      fatPercentage = 0.25;
    } else {
      proteinGramsPerKg = 1.6;
      fatPercentage = 0.28;
    }

    const proteinGrams = Math.round(weightKg * proteinGramsPerKg);
    const proteinCalories = proteinGrams * 4;

    const fatCalories = targetCalories * fatPercentage;
    const fatGrams = Math.round(fatCalories / 9);

    const remainingCalories = Math.max(0, targetCalories - (proteinCalories + fatCalories));
    const carbsGrams = Math.round(remainingCalories / 4);

    return {
      protein: {
        grams: proteinGrams,
        calories: proteinCalories,
        percent: Math.round((proteinCalories / targetCalories) * 100)
      },
      fat: {
        grams: fatGrams,
        calories: Math.round(fatCalories),
        percent: Math.round((fatCalories / targetCalories) * 100)
      },
      carbs: {
        grams: carbsGrams,
        calories: Math.round(remainingCalories),
        percent: Math.round((remainingCalories / targetCalories) * 100)
      }
    };
  }

  // 5. Calculate Body Mass Index (BMI)
  function calculateBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm) return null;
    const heightM = heightCm / 100;
    const bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(1));

    let category = 'Normal weight';
    let color = '#10e759';

    if (bmi < 18.5) {
      category = 'Underweight';
      color = '#38bdf8';
    } else if (bmi >= 18.5 && bmi <= 24.9) {
      category = 'Normal weight';
      color = '#10e759';
    } else if (bmi >= 25 && bmi <= 29.9) {
      category = 'Overweight';
      color = '#f59e0b';
    } else {
      category = 'Obesity range';
      color = '#ef4444';
    }

    return {
      bmi,
      category,
      color,
      note: 'BMI is an epidemiological population indicator. Athletic individuals with high muscle mass may present elevated BMI without elevated body fat.'
    };
  }

  // Unit Converters
  function lbsToKg(lbs) { return parseFloat((lbs * 0.453592).toFixed(1)); }
  function kgToLbs(kg) { return parseFloat((kg * 2.20462).toFixed(1)); }
  function feetInchesToCm(feet, inches) { return Math.round((feet * 30.48) + (inches * 2.54)); }
  function cmToFeetInches(cm) {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { feet, inches };
  }

  return {
    calculateBMR,
    calculateTDEE,
    calculateTargets,
    calculateMacros,
    calculateBMI,
    lbsToKg,
    kgToLbs,
    feetInchesToCm,
    cmToFeetInches
  };
})();


// ========================================================
// MODULE: js/nutrition.js
// ========================================================
// public/js/nutrition.js
// Verified Nutrition Database, Personalized Meal Plans & Food Logger

const Nutrition = (() => {
  const FOOD_LOGS_KEY = 'fitai_food_logs';

  // 1. Curated Food Composition Database
  const FOOD_DATABASE = [
    // Indian Breads & Grains
    { id: 'roti_wheat', name: 'Whole Wheat Roti (Phulka)', serving: '1 medium (35g raw)', calories: 85, protein: 2.8, carbs: 17.0, fat: 0.8, fiber: 2.5, category: 'grains', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'rice_white', name: 'Cooked White Rice', serving: '1 katori / cup (150g)', calories: 195, protein: 4.0, carbs: 43.0, fat: 0.5, fiber: 0.6, category: 'grains', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'rice_brown', name: 'Cooked Brown Rice', serving: '1 katori / cup (150g)', calories: 165, protein: 3.8, carbs: 35.0, fat: 1.4, fiber: 2.8, category: 'grains', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'oats_cooked', name: 'Rolled Oats Porridge (in water)', serving: '1 bowl (40g dry)', calories: 150, protein: 5.5, carbs: 27.0, fat: 2.5, fiber: 4.0, category: 'grains', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'poha_veg', name: 'Vegetable Poha with peanuts', serving: '1 plate (150g)', calories: 230, protein: 5.0, carbs: 36.0, fat: 7.5, fiber: 3.0, category: 'grains', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'idli_sambar', name: 'Steamed Idli (2 pcs) with Sambar', serving: '2 idlis + 1 bowl sambar', calories: 210, protein: 7.2, carbs: 40.0, fat: 2.2, fiber: 4.5, category: 'grains', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'dosa_plain', name: 'Plain Crisp Dosa with Sambar', serving: '1 medium dosa (80g)', calories: 170, protein: 4.5, carbs: 30.0, fat: 4.0, fiber: 2.0, category: 'grains', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },

    // Dals & Legumes
    { id: 'dal_moong', name: 'Moong Dal (Yellow Lentil Tadka)', serving: '1 bowl (150g cooked)', calories: 135, protein: 8.5, carbs: 20.0, fat: 2.5, fiber: 4.5, category: 'legumes', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'dal_toor', name: 'Toor Dal Tadka', serving: '1 bowl (150g cooked)', calories: 150, protein: 8.0, carbs: 22.0, fat: 3.5, fiber: 4.0, category: 'legumes', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'chana_boiled', name: 'Boiled Chickpeas (Kabuli Chana)', serving: '1 bowl (150g cooked)', calories: 240, protein: 13.0, carbs: 40.0, fat: 3.8, fiber: 10.0, category: 'legumes', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'rajma_masala', name: 'Rajma Masala (Red Kidney Beans)', serving: '1 bowl (150g cooked)', calories: 215, protein: 11.5, carbs: 34.0, fat: 3.5, fiber: 9.0, category: 'legumes', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'soya_chunks', name: 'Soya Chunks Curry', serving: '1 bowl (50g dry cooked)', calories: 175, protein: 26.0, carbs: 14.0, fat: 0.5, fiber: 6.5, category: 'legumes', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },

    // Dairy & Plant Proteins
    { id: 'paneer_lowfat', name: 'Low-Fat Paneer / Cottage Cheese', serving: '100g raw/grilled', calories: 170, protein: 19.0, carbs: 3.5, fat: 9.0, fiber: 0, category: 'dairy', diet: ['vegetarian', 'eggetarian', 'non_vegetarian'] },
    { id: 'paneer_regular', name: 'Regular Fresh Paneer', serving: '100g', calories: 265, protein: 18.0, carbs: 4.0, fat: 20.0, fiber: 0, category: 'dairy', diet: ['vegetarian', 'eggetarian', 'non_vegetarian'] },
    { id: 'tofu_firm', name: 'Firm Tofu (Soya Paneer)', serving: '100g pan-seared', calories: 95, protein: 12.0, carbs: 2.5, fat: 4.5, fiber: 1.5, category: 'plant_protein', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'curd_dahi', name: 'Homemade Curd (Dahi) from toned milk', serving: '1 cup / bowl (150g)', calories: 90, protein: 5.5, carbs: 6.5, fat: 4.5, fiber: 0, category: 'dairy', diet: ['vegetarian', 'eggetarian', 'non_vegetarian'] },
    { id: 'milk_toned', name: 'Toned Cow Milk (Warm/Cold)', serving: '1 glass (200ml)', calories: 120, protein: 6.4, carbs: 9.5, fat: 6.0, fiber: 0, category: 'dairy', diet: ['vegetarian', 'eggetarian', 'non_vegetarian'] },

    // Eggs & Poultry & Fish
    { id: 'egg_boiled_whole', name: 'Whole Boiled Egg', serving: '1 large egg (50g)', calories: 74, protein: 6.3, carbs: 0.4, fat: 5.0, fiber: 0, category: 'eggs', diet: ['eggetarian', 'non_vegetarian'] },
    { id: 'egg_white', name: 'Boiled Egg White', serving: '2 egg whites (66g)', calories: 34, protein: 7.2, carbs: 0.4, fat: 0.2, fiber: 0, category: 'eggs', diet: ['eggetarian', 'non_vegetarian'] },
    { id: 'chicken_breast', name: 'Grilled Chicken Breast', serving: '150g cooked', calories: 245, protein: 46.0, carbs: 0.0, fat: 5.2, fiber: 0, category: 'meat', diet: ['non_vegetarian'] },
    { id: 'fish_grilled', name: 'Tawa Grilled Fish (Rohu / Pomfret)', serving: '150g fillet', calories: 180, protein: 32.0, carbs: 0.0, fat: 5.5, fiber: 0, category: 'meat', diet: ['non_vegetarian'] },

    // Vegetables & Salads
    { id: 'mixed_veg_sabzi', name: 'Homestyle Mixed Veg Sabzi (light oil)', serving: '1 bowl (150g)', calories: 95, protein: 2.5, carbs: 12.0, fat: 4.0, fiber: 4.2, category: 'vegetables', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'palak_spinach', name: 'Sautéed Garlic Palak (Spinach)', serving: '1 bowl (150g)', calories: 60, protein: 3.5, carbs: 5.0, fat: 3.0, fiber: 3.5, category: 'vegetables', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'salad_cucumber_tomato', name: 'Green Salad (Cucumber, Tomato, Onion, Lemon)', serving: '1 medium plate (150g)', calories: 35, protein: 1.2, carbs: 7.0, fat: 0.3, fiber: 2.8, category: 'vegetables', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },

    // Fruits & Healthy Snacks
    { id: 'banana', name: 'Fresh Banana', serving: '1 medium (118g)', calories: 105, protein: 1.3, carbs: 27.0, fat: 0.3, fiber: 3.1, category: 'fruits', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'apple', name: 'Red Apple with skin', serving: '1 medium (150g)', calories: 80, protein: 0.5, carbs: 21.0, fat: 0.3, fiber: 4.0, category: 'fruits', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'papaya', name: 'Fresh Diced Papaya', serving: '1 cup (145g)', calories: 55, protein: 0.9, carbs: 14.0, fat: 0.3, fiber: 2.5, category: 'fruits', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'almonds_soaked', name: 'Raw / Soaked Almonds', serving: '8-10 kernels (12g)', calories: 70, protein: 2.5, carbs: 2.5, fat: 6.0, fiber: 1.5, category: 'nuts', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'roasted_makhana', name: 'Roasted Fox Nuts (Makhana) with pinch salt', serving: '1 bowl (30g)', calories: 105, protein: 3.0, carbs: 20.0, fat: 1.0, fiber: 2.2, category: 'snacks', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] },
    { id: 'roasted_chana_snack', name: 'Roasted Black Chana (with peel)', serving: '1 small bowl (30g)', calories: 110, protein: 6.0, carbs: 17.0, fat: 1.8, fiber: 5.0, category: 'snacks', diet: ['vegetarian', 'vegan', 'eggetarian', 'non_vegetarian'] }
  ];

  // 2. Personalized Meal Plan Generator
  function generateMealPlan(targetCalories = 2000, dietType = 'vegetarian', goal = 'fat_loss') {
    const isVeg = dietType === 'vegetarian';
    const isVegan = dietType === 'vegan';
    const isNonVeg = dietType === 'non_vegetarian';
    const isEgg = dietType === 'eggetarian';

    const proteinSourceLunch = isVegan
      ? { name: '120g Pan-Seared Firm Tofu', cal: 115, p: 14, c: 3, f: 5 }
      : isNonVeg
      ? { name: '150g Grilled Chicken Breast', cal: 245, p: 46, c: 0, f: 5 }
      : isEgg
      ? { name: '2 Whole Boiled Eggs + 2 Egg Whites', cal: 182, p: 20, c: 1, f: 10 }
      : { name: '100g Low-Fat Paneer Bhurji', cal: 170, p: 19, c: 3.5, f: 9 };

    const proteinSourceDinner = isVegan
      ? { name: '1 Bowl Soya Chunks Curry (50g dry)', cal: 175, p: 26, c: 14, f: 0.5 }
      : isNonVeg
      ? { name: '150g Tawa Grilled Fish Fillet', cal: 180, p: 32, c: 0, f: 5.5 }
      : { name: '1 Bowl Moong Dal Tadka (150g)', cal: 135, p: 8.5, c: 20, f: 2.5 };

    const snackProtein = isVegan
      ? { name: 'Roasted Black Chana (30g)', cal: 110, p: 6, c: 17, f: 1.8 }
      : isNonVeg || isEgg
      ? { name: '2 Boiled Egg Whites', cal: 34, p: 7.2, c: 0.4, f: 0.2 }
      : { name: '1 Cup Fresh Dahi / Curd', cal: 90, p: 5.5, c: 6.5, f: 4.5 };

    const plan = {
      title: `${dietType.replace('_', ' ').toUpperCase()} Plan — ${goal.replace('_', ' ').toUpperCase()}`,
      targetCalories,
      meals: [
        {
          name: 'Breakfast (8:30 AM)',
          items: [
            { item: isVegan ? 'Vegetable Poha with peanuts (1 plate)' : 'Rolled Oats Porridge with 1 glass milk & chia seeds', portion: '1 bowl', cal: 260, p: 9, c: 42, f: 6 },
            { item: 'Soaked Almonds & Walnuts', portion: '8 kernels', cal: 70, p: 2.5, c: 2.5, f: 6 }
          ],
          substitutions: 'Substitute with 2 Besan Chillas or 2 Idlis with Sambar.'
        },
        {
          name: 'Mid-Morning Snack (11:30 AM)',
          items: [
            { item: 'Fresh Fruit (Apple or Papaya)', portion: '1 cup (150g)', cal: 80, p: 0.8, c: 20, f: 0.3 },
            { item: 'Green Tea or Warm Lemon Water', portion: '1 cup', cal: 2, p: 0, c: 0.5, f: 0 }
          ],
          substitutions: '1 glass fresh coconut water or seasonal orange.'
        },
        {
          name: 'Lunch (1:30 PM)',
          items: [
            { item: 'Whole Wheat Phulkas / Rotis', portion: '2 rotis', cal: 170, p: 5.6, c: 34, f: 1.6 },
            { item: proteinSourceLunch.name, portion: '1 serving', cal: proteinSourceLunch.cal, p: proteinSourceLunch.p, c: proteinSourceLunch.c, f: proteinSourceLunch.f },
            { item: 'Homestyle Dal or Rajma', portion: '1 bowl (150g)', cal: 140, p: 8.5, c: 22, f: 2.5 },
            { item: 'Cucumber & Tomato Salad with Lemon', portion: '1 plate', cal: 35, p: 1.2, c: 7, f: 0.3 }
          ],
          substitutions: 'Swap 2 rotis with 1 cup cooked brown rice.'
        },
        {
          name: 'Evening Snack (5:00 PM)',
          items: [
            { item: snackProtein.name, portion: '1 serving', cal: snackProtein.cal, p: snackProtein.p, c: snackProtein.c, f: snackProtein.f },
            { item: 'Roasted Fox Nuts (Makhana)', portion: '1 small bowl (20g)', cal: 70, p: 2, c: 14, f: 0.7 }
          ],
          substitutions: 'Sprouted moong salad with diced onion, tomato, and chaat masala.'
        },
        {
          name: 'Dinner (8:00 PM)',
          items: [
            { item: 'Whole Wheat Phulkas', portion: '2 rotis (or 1 cup quinoa/brown rice)', cal: 170, p: 5.6, c: 34, f: 1.6 },
            { item: proteinSourceDinner.name, portion: '1 bowl', cal: proteinSourceDinner.cal, p: proteinSourceDinner.p, c: proteinSourceDinner.c, f: proteinSourceDinner.f },
            { item: 'Stir-Fried Seasonal Sabzi (Bhindi/Gobi/Palak)', portion: '1 bowl (150g)', cal: 95, p: 2.5, c: 12, f: 4 }
          ],
          substitutions: 'For fat loss, substitute one roti with a warm bowl of vegetable soup.'
        }
      ]
    };

    // Calculate totals
    let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
    plan.meals.forEach(m => {
      m.mealCal = m.items.reduce((sum, i) => sum + i.cal, 0);
      m.mealProtein = m.items.reduce((sum, i) => sum + i.p, 0);
      totalCal += m.mealCal;
      totalP += m.mealProtein;
    });

    plan.dailyTotal = {
      calories: Math.round(totalCal),
      protein: Math.round(totalP),
      carbs: Math.round(totalCal * 0.45 / 4),
      fat: Math.round(totalCal * 0.25 / 9)
    };

    return plan;
  }

  // 3. Daily Food Log Operations
  function getDailyFoodLogs(dateStr = new Date().toISOString().split('T')[0]) {
    try {
      const all = JSON.parse(localStorage.getItem(FOOD_LOGS_KEY) || '[]');
      return all.filter(item => item.date === dateStr);
    } catch (e) {
      return [];
    }
  }

  function addFoodLog(item, multiplier = 1, mealType = 'lunch') {
    const today = new Date().toISOString().split('T')[0];
    const logItem = {
      id: 'food_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      date: today,
      mealType,
      name: item.name,
      serving: `${multiplier}x ${item.serving}`,
      calories: Math.round(item.calories * multiplier),
      protein: parseFloat((item.protein * multiplier).toFixed(1)),
      carbs: parseFloat((item.carbs * multiplier).toFixed(1)),
      fat: parseFloat((item.fat * multiplier).toFixed(1)),
      fiber: parseFloat(((item.fiber || 0) * multiplier).toFixed(1)),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const all = JSON.parse(localStorage.getItem(FOOD_LOGS_KEY) || '[]');
    all.unshift(logItem);
    localStorage.setItem(FOOD_LOGS_KEY, JSON.stringify(all));

    // Async server sync
    const token = Auth.getAuthToken();
    if (token) {
      fetch('/api/profile/food-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          food_name: logItem.name,
          serving_size: logItem.serving,
          meal_type: logItem.mealType,
          calories: logItem.calories,
          protein: logItem.protein,
          carbs: logItem.carbs,
          fat: logItem.fat,
          fiber: logItem.fiber
        })
      }).catch(e => console.warn('Food log offline sync pending:', e));
    }

    return logItem;
  }

  function removeFoodLog(id) {
    const all = JSON.parse(localStorage.getItem(FOOD_LOGS_KEY) || '[]');
    const filtered = all.filter(item => item.id !== id);
    localStorage.setItem(FOOD_LOGS_KEY, JSON.stringify(filtered));
  }

  function getDailyNutrientTotals(dateStr = new Date().toISOString().split('T')[0]) {
    const logs = getDailyFoodLogs(dateStr);
    return logs.reduce((acc, cur) => {
      acc.calories += cur.calories || 0;
      acc.protein += cur.protein || 0;
      acc.carbs += cur.carbs || 0;
      acc.fat += cur.fat || 0;
      acc.fiber += cur.fiber || 0;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  }

  return {
    FOOD_DATABASE,
    generateMealPlan,
    getDailyFoodLogs,
    addFoodLog,
    removeFoodLog,
    getDailyNutrientTotals
  };
})();


// ========================================================
// MODULE: js/water.js
// ========================================================
// public/js/water.js
// Daily Hydration Tracker with Animated Ring, Log History & Reminders

const Water = (() => {
  const WATER_LOGS_KEY = 'fitai_water_logs';
  const TARGET_KEY = 'fitai_water_target';

  function getDailyTarget() {
    const saved = localStorage.getItem(TARGET_KEY);
    if (saved) return parseInt(saved);

    const profile = Auth.loadProfile();
    if (profile && profile.weight) {
      // 35ml per kg baseline, adjusted for activity
      const baseline = Math.round(profile.weight * 35);
      return Math.max(2000, Math.min(4500, baseline));
    }
    return 2800; // Default 2.8 Liters
  }

  function setDailyTarget(targetMl) {
    if (targetMl && targetMl > 500) {
      localStorage.setItem(TARGET_KEY, targetMl.toString());
    }
  }

  function getTodayLogs(dateStr = new Date().toISOString().split('T')[0]) {
    try {
      const all = JSON.parse(localStorage.getItem(WATER_LOGS_KEY) || '[]');
      return all.filter(l => l.date === dateStr);
    } catch (e) {
      return [];
    }
  }

  function getTodayTotal(dateStr = new Date().toISOString().split('T')[0]) {
    const logs = getTodayLogs(dateStr);
    return logs.reduce((sum, item) => sum + (item.amount || 0), 0);
  }

  function addWater(amountMl) {
    const amount = parseInt(amountMl);
    if (isNaN(amount) || amount <= 0) return null;

    const today = new Date().toISOString().split('T')[0];
    const logItem = {
      id: 'water_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      date: today,
      amount,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const all = JSON.parse(localStorage.getItem(WATER_LOGS_KEY) || '[]');
    all.unshift(logItem);
    localStorage.setItem(WATER_LOGS_KEY, JSON.stringify(all));

    // Async server sync
    const token = Auth.getAuthToken();
    if (token) {
      fetch('/api/profile/water-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount_ml: amount })
      }).catch(e => console.warn('Water log sync pending offline:', e));
    }

    return logItem;
  }

  function removeLog(id) {
    const all = JSON.parse(localStorage.getItem(WATER_LOGS_KEY) || '[]');
    const filtered = all.filter(l => l.id !== id);
    localStorage.setItem(WATER_LOGS_KEY, JSON.stringify(filtered));
  }

  // Request browser notification permission for water reminders
  async function requestReminderPermission() {
    if (!('Notification' in window)) {
      return { supported: false, status: 'unsupported' };
    }
    const perm = await Notification.requestPermission();
    return { supported: true, status: perm };
  }

  function scheduleHydrationReminder() {
    if ('Notification' in window && Notification.permission === 'granted') {
      setTimeout(() => {
        new Notification('💧 Hydration Check — FitAI Coach', {
          body: 'Time to drink a glass of water (250 ml) to maintain your metabolic rate and focus!',
          icon: '/assets/icons/icon-192.png'
        });
      }, 7200000); // 2 hours
    }
  }

  return {
    getDailyTarget,
    setDailyTarget,
    getTodayLogs,
    getTodayTotal,
    addWater,
    removeLog,
    requestReminderPermission,
    scheduleHydrationReminder
  };
})();


// ========================================================
// MODULE: js/workouts.js
// ========================================================
// public/js/workouts.js
// 40+ Yoga Poses, 20+ Fitness Exercises & Personalized 7-Day Workout Plans

const Workouts = (() => {
  // 1. Library of 40+ Authentic Yoga Poses with Sanskrit names, difficulty, guidelines, and rules
  const YOGA_POSES = [
    {
      id: 'tadasana',
      sanskrit: 'Tadasana',
      english: 'Mountain Pose',
      category: 'standing',
      difficulty: 'beginner',
      target: 'Spinal alignment, posture, quadriceps, core stability',
      instructions: 'Stand tall with big toes touching, heels slightly apart. Ground through all four corners of feet. Engage quadriceps, draw tailbone down slightly, broaden collarbones, and align ears directly over shoulders.',
      benefits: 'Improves posture, strengthens arches of feet, calms nervous system.',
      safety: 'Avoid locking knees. If experiencing dizziness, separate feet hip-width.',
      cameraMode: 'full_body_front',
      rules: { spineVertical: true, kneeAngle: [170, 180], ankleDistanceMax: 0.15 }
    },
    {
      id: 'vrikshasana',
      sanskrit: 'Vrikshasana',
      english: 'Tree Pose',
      category: 'balance',
      difficulty: 'beginner',
      target: 'Ankles, calves, inner thighs, balance, concentration',
      instructions: 'Root firmly into left foot. Place right sole either on inner left calf or upper inner thigh—never on the knee joint. Bring hands together in prayer at chest center (Anjali Mudra). Focus gaze (drishti) on an unmoving point.',
      benefits: 'Builds neuromuscular coordination, opens groin, strengthens ankles.',
      safety: 'Never place the foot directly on the knee joint.',
      cameraMode: 'full_body_front',
      rules: { standingLegStraight: true, bentKneeAngle: [40, 85], hipLevel: true }
    },
    {
      id: 'trikonasana',
      sanskrit: 'Trikonasana',
      english: 'Triangle Pose',
      category: 'standing',
      difficulty: 'intermediate',
      target: 'Hamstrings, groins, hips, obliques, thoracic expansion',
      instructions: 'Step feet 3.5–4 feet apart. Turn right foot out 90°, left foot in slightly. Inhale reach right arm forward, hinge at hip crease. Lower right hand to shin or block, extend left arm toward ceiling.',
      benefits: 'Stretches spine, stimulates abdominal organs, relieves back stiffness.',
      safety: 'Do not lock front knee; maintain micro-bend if hamstrings are tight.',
      cameraMode: 'full_body_front',
      rules: { frontLegAngle: [165, 180], armsOppositeVertical: true }
    },
    {
      id: 'virabhadrasana_1',
      sanskrit: 'Virabhadrasana I',
      english: 'Warrior I',
      category: 'standing',
      difficulty: 'intermediate',
      target: 'Quads, hip flexors, shoulders, back extensors',
      instructions: 'From standing, step left foot back 3.5 feet, angle at 45°. Bend right knee directly over right ankle (90°). Square hips forward as much as comfortable, sweep arms overhead with palms facing inward.',
      benefits: 'Strengthens shoulders, arms, legs; opens chest and lungs.',
      safety: 'Keep back heel firmly planted. Reduce stance if back knee strains.',
      cameraMode: 'full_body_side',
      rules: { frontKneeAngle: [85, 105], torsoVertical: true, backLegAngle: [165, 180] }
    },
    {
      id: 'virabhadrasana_2',
      sanskrit: 'Virabhadrasana II',
      english: 'Warrior II',
      category: 'standing',
      difficulty: 'beginner',
      target: 'Adductors, quadriceps, gluteus medius, deltoids',
      instructions: 'Step feet wide (~4 feet). Turn right foot out 90°, left foot parallel to back mat. Bend right knee to 90° tracking towards second toe. Extend arms parallel to ground, gaze over front middle fingertip.',
      benefits: 'Builds leg stamina, relieves backaches, opens chest and hips.',
      safety: 'Do not let front knee collapse inward.',
      cameraMode: 'full_body_front',
      rules: { frontKneeAngle: [85, 100], armsHorizontal: true, torsoCentered: true }
    },
    {
      id: 'virabhadrasana_3',
      sanskrit: 'Virabhadrasana III',
      english: 'Warrior III',
      category: 'balance',
      difficulty: 'advanced',
      target: 'Glutes, hamstrings, back extensors, core stabilizers',
      instructions: 'Shift weight to right foot. Hinge forward at hip, lifting left leg behind you until torso and back leg form a horizontal line parallel to the mat. Extend arms forward or alongside torso.',
      benefits: 'Full-body balance, strengthens ankles, tones posterior chain.',
      safety: 'Keep hips square to the mat. Avoid hyperextending standing knee.',
      cameraMode: 'full_body_side',
      rules: { torsoLegParallel: true, standingLegAngle: [165, 180] }
    },
    {
      id: 'adho_mukha_svanasana',
      sanskrit: 'Adho Mukha Svanasana',
      english: 'Downward-Facing Dog',
      category: 'inversion',
      difficulty: 'beginner',
      target: 'Shoulders, hamstrings, calves, spine decompression',
      instructions: 'From hands and knees, tuck toes and lift hips toward ceiling, forming an inverted V. Press firmly through index knuckles. Lengthen spine, draw sit bones high, press heels toward mat.',
      benefits: 'Energizes body, relieves back pain, strengthens arms and legs.',
      safety: 'Bend knees generously if hamstrings or lower back are tight.',
      cameraMode: 'full_body_side',
      rules: { invertedVAngle: [70, 95], armsStraight: true }
    },
    {
      id: 'bhujangasana',
      sanskrit: 'Bhujangasana',
      english: 'Cobra Pose',
      category: 'prone',
      difficulty: 'beginner',
      target: 'Erector spinae, chest, anterior deltoids, glutes',
      instructions: 'Lie prone with legs extended, tops of feet on mat. Place palms beneath shoulders. Inhale, press tops of feet down and lift chest forward and up using back muscles, keeping elbows close to ribs.',
      benefits: 'Strengthens spine, opens heart and lungs, tones gluteal muscles.',
      safety: 'Avoid jamming lower back. Keep elbows softly bent.',
      cameraMode: 'floor_side',
      rules: { chestElevated: true, elbowsBentTucked: true }
    },
    {
      id: 'balasana',
      sanskrit: 'Balasana',
      english: "Child's Pose",
      category: 'prone',
      difficulty: 'beginner',
      target: 'Hips, thighs, ankles, spine decompression',
      instructions: 'Kneel on the floor, touch big toes together, sit on heels. Separate knees hip-width or wider. Exhale, fold torso forward between thighs, resting forehead gently on mat. Extend arms forward.',
      benefits: 'Deeply calming restorative pose, relieves fatigue and stress.',
      safety: 'Place a blanket under knees or behind knee creases if experiencing discomfort.',
      cameraMode: 'floor_side',
      rules: { hipsOnHeels: true, foreheadRested: true }
    },
    {
      id: 'setu_bandhasana',
      sanskrit: 'Setu Bandhasana',
      english: 'Bridge Pose',
      category: 'supine',
      difficulty: 'beginner',
      target: 'Glutes, hamstrings, chest, hip flexor stretch',
      instructions: 'Lie supine with knees bent, feet hip-width flat on mat close to sit bones. Exhale, press through heels and lift hips toward ceiling. Clasp hands beneath pelvis, roll outer shoulders under.',
      benefits: 'Rejuvenates tired legs, stretches chest and neck, stimulates thyroid.',
      safety: 'Keep knees parallel; do not turn neck while hips are elevated.',
      cameraMode: 'floor_side',
      rules: { hipExtensionAngle: [150, 180], kneesOverAnkles: true }
    },
    {
      id: 'utkatasana',
      sanskrit: 'Utkatasana',
      english: 'Chair Pose',
      category: 'standing',
      difficulty: 'intermediate',
      target: 'Quadriceps, glutes, calves, spinal extensors',
      instructions: 'Inhale, sweep arms overhead parallel to ears. Exhale, bend knees and sit hips back as if into a chair. Keep weight rooted in heels, draw belly button to spine.',
      benefits: 'Tones leg muscles, stimulates abdominal organs, strengthens ankles.',
      safety: 'Keep knees behind toes to protect knee joints.',
      cameraMode: 'full_body_side',
      rules: { kneeBendAngle: [90, 130], torsoInclineAngle: [40, 60] }
    },
    {
      id: 'vriksha_variation',
      sanskrit: 'Vrikshasana Variation',
      english: 'Tree Pose with Raised Arms',
      category: 'balance',
      difficulty: 'intermediate',
      target: 'Shoulders, core balance, ankle stability',
      instructions: 'In Tree Pose, slowly sweep arms upward overhead into a wide V or clasp fingers and turn palms to ceiling, challenging vestibular balance.',
      benefits: 'Enhances proprioception, shoulder mobility, mental focus.',
      safety: 'Keep focus on steady drishti point; step down if losing balance.',
      cameraMode: 'full_body_front',
      rules: { armsOverhead: true, standingLegStraight: true }
    },
    {
      id: 'ardha_chandrasana',
      sanskrit: 'Ardha Chandrasana',
      english: 'Half Moon Pose',
      category: 'balance',
      difficulty: 'advanced',
      target: 'Outer hips, gluteus medius, spine, core',
      instructions: 'From Triangle pose, bend front knee, place fingertips 12 inches ahead on mat or block. Lift back leg parallel to floor, stack top hip and shoulder, extend top arm vertically.',
      benefits: 'Strengthens ankles and spine, expands chest, improves coordination.',
      safety: 'Use a yoga block under lower hand to maintain open thoracic alignment.',
      cameraMode: 'full_body_front',
      rules: { liftedLegAngle: [165, 185], stackedShoulders: true }
    },
    {
      id: 'anjaneyasana',
      sanskrit: 'Anjaneyasana',
      english: 'Low Lunge',
      category: 'standing',
      difficulty: 'beginner',
      target: 'Hip flexors, psoas, quads, chest expansion',
      instructions: 'From Downward Dog, step right foot between hands. Lower left knee to mat, release top of foot. Sweep arms overhead, lift ribcage away from hips, sink pelvis gently forward.',
      benefits: 'Relieves tightness from sitting, stretches hip flexors, energizes body.',
      safety: 'Pad back knee with a folded blanket if kneecap is sensitive.',
      cameraMode: 'full_body_side',
      rules: { frontKneeAngle: [85, 100], backKneeDown: true }
    },
    {
      id: 'malasana',
      sanskrit: 'Malasana',
      english: 'Garland Pose (Deep Squat)',
      category: 'standing',
      difficulty: 'beginner',
      target: 'Hips, groins, ankles, lower back decompression',
      instructions: 'Stand with feet wider than hips, toes turned out 30–45°. Exhale, bend knees and squat down deeply. Press elbows against inner knees, bring hands into prayer, lengthen spine.',
      benefits: 'Promotes healthy pelvic mobility, aids digestion, stretches achilles tendons.',
      safety: 'Place a rolled mat or blanket under heels if they lift off floor.',
      cameraMode: 'full_body_front',
      rules: { deepSquatAngle: [50, 85], spineErect: true }
    },
    {
      id: 'sukhasana',
      sanskrit: 'Sukhasana',
      english: 'Easy Pose',
      category: 'seated',
      difficulty: 'beginner',
      target: 'Spinal erectness, inner hips, meditative breathing',
      instructions: 'Sit on mat with crossed shins, feet resting beneath knees. Sit tall with natural curve in lower back, relax shoulders, rest hands on knees in Jnana Mudra.',
      benefits: 'Calms mind, encourages diaphragmatic breathing, improves seated posture.',
      safety: 'Sit on a cushion or yoga block if knees are higher than hips.',
      cameraMode: 'floor_front',
      rules: { uprightSpine: true, crossedLegs: true }
    },
    {
      id: 'padmasana',
      sanskrit: 'Padmasana',
      english: 'Lotus Pose',
      category: 'seated',
      difficulty: 'advanced',
      target: 'Knee ligaments, hips, ankles, meditation focus',
      instructions: 'From seated position, place right foot on left upper thigh, sole facing up. Carefully lift left foot and place on right upper thigh. Keep spine tall and palms open.',
      benefits: 'Stabilizes pelvic circulation, primes nervous system for meditation.',
      safety: 'Do not force into knees! Substitute with Ardha Padmasana (Half Lotus) or Sukhasana.',
      cameraMode: 'floor_front',
      rules: { fullCrossedLegs: true, uprightSpine: true }
    },
    {
      id: 'vajrasana',
      sanskrit: 'Vajrasana',
      english: 'Thunderbolt Pose',
      category: 'seated',
      difficulty: 'beginner',
      target: 'Quadriceps, ankles, digestive tract stimulation',
      instructions: 'Kneel with big toes touching and heels separated. Sit hips onto the cradle of your heels. Rest hands palms-down on thighs. Breathe slowly.',
      benefits: 'Excellent post-meal pose to assist digestion, relieves sciatic discomfort.',
      safety: 'Place a blanket between calves and thighs if experiencing knee strain.',
      cameraMode: 'floor_side',
      rules: { kneelingSeated: true, spineUpright: true }
    },
    {
      id: 'paschimottanasana',
      sanskrit: 'Paschimottanasana',
      english: 'Seated Forward Bend',
      category: 'seated',
      difficulty: 'intermediate',
      target: 'Hamstrings, calves, entire posterior spinal chain',
      instructions: 'Sit with legs extended straight in front, feet flexed. Inhale, reach arms overhead; exhale, hinge at hips and reach for shins, ankles, or outer feet, keeping spine long.',
      benefits: 'Calms nervous system, stretches entire backside of body, massages abdominal viscera.',
      safety: 'Do not round violently through thoracic spine; bend knees slightly if hamstrings pull.',
      cameraMode: 'floor_side',
      rules: { forwardFoldAngle: [30, 75], legsExtended: true }
    },
    {
      id: 'baddha_konasana',
      sanskrit: 'Baddha Konasana',
      english: 'Bound Angle Pose (Butterfly)',
      category: 'seated',
      difficulty: 'beginner',
      target: 'Adductors, groins, pelvic floor mobility',
      instructions: 'Sit tall, bend knees, and bring soles of feet together. Hold outer feet or ankles with hands, gently release knees toward floor without bouncing.',
      benefits: 'Opens inner hips, stimulates pelvic blood circulation, relieves menstrual cramps.',
      safety: 'Support outer thighs with yoga blocks if knees are sensitive.',
      cameraMode: 'floor_front',
      rules: { feetTogether: true, kneesAbducted: true }
    },
    {
      id: 'marjaryasana',
      sanskrit: 'Marjaryasana',
      english: 'Cat Pose',
      category: 'prone',
      difficulty: 'beginner',
      target: 'Spinal flexion, transverse abdominis, neck release',
      instructions: 'Start on hands and knees (tabletop). Exhale, round spine upward toward ceiling, tuck chin toward chest, draw navel in firmly.',
      benefits: 'Releases spinal tension, improves segmental mobility, stretches upper back.',
      safety: 'Ensure wrists are stacked directly beneath shoulder joints.',
      cameraMode: 'floor_side',
      rules: { roundedSpine: true, headTucked: true }
    },
    {
      id: 'bitilasana',
      sanskrit: 'Bitilasana',
      english: 'Cow Pose',
      category: 'prone',
      difficulty: 'beginner',
      target: 'Spinal extension, pectorals, anterior neck',
      instructions: 'From tabletop, inhale, drop belly toward mat, lift sit bones and chest toward ceiling, gazing gently upward.',
      benefits: 'Stretches anterior torso and neck, warms up spine for flow.',
      safety: 'Avoid compressing back of neck; gaze gently up and forward.',
      cameraMode: 'floor_side',
      rules: { archedSpine: true, chestLifted: true }
    },
    {
      id: 'phalakasana',
      sanskrit: 'Phalakasana',
      english: 'Plank Pose',
      category: 'arm_balance',
      difficulty: 'beginner',
      target: 'Core, serratus anterior, deltoids, quadriceps',
      instructions: 'From hands and knees or Downward Dog, bring shoulders directly over wrists. Form a straight diagonal line from crown of head to heels. Engage glutes and core.',
      benefits: 'Builds foundational core and shoulder stability, tones abdominal wall.',
      safety: 'Do not let hips sag or hike into an inverted V.',
      cameraMode: 'floor_side',
      rules: { bodyStraightLine: true, shoulderOverWrist: true }
    },
    {
      id: 'chaturanga_dandasana',
      sanskrit: 'Chaturanga Dandasana',
      english: 'Four-Limbed Staff Pose',
      category: 'arm_balance',
      difficulty: 'advanced',
      target: 'Triceps, pectorals, anterior deltoids, deep core',
      instructions: 'From Plank, shift weight slightly forward on toes. Exhale, lower body parallel to floor until elbows are at a precise 90° angle, pinned closely against ribcage.',
      benefits: 'Develops immense upper body push strength and wrist endurance.',
      safety: 'Never let shoulders dip below elbow level to protect rotator cuff.',
      cameraMode: 'floor_side',
      rules: { elbowAngle90: true, bodyHoveringStraight: true }
    },
    {
      id: 'salabhasana',
      sanskrit: 'Salabhasana',
      english: 'Locust Pose',
      category: 'prone',
      difficulty: 'beginner',
      target: 'Gluteus maximus, hamstrings, erector spinae, rhomboids',
      instructions: 'Lie prone with arms along sides, palms down. Exhale, lift head, chest, arms, and legs simultaneously off mat. Reach back actively through toes.',
      benefits: 'Counteracts desk sitting posture, strengthens lower back, stimulates kidneys.',
      safety: 'Lengthen the neck by gazing at the front edge of the mat.',
      cameraMode: 'floor_side',
      rules: { chestAndLegsLifted: true }
    },
    {
      id: 'dhanurasana',
      sanskrit: 'Dhanurasana',
      english: 'Bow Pose',
      category: 'prone',
      difficulty: 'intermediate',
      target: 'Thoracic extension, quadriceps, chest, shoulders',
      instructions: 'Lie prone, bend knees, reach back and clasp outside of ankles. Inhale, kick shins backward and upward, lifting chest and thighs off mat into a bow shape.',
      benefits: 'Expands thoracic cage, relieves mild backaches, strengthens back muscles.',
      safety: 'Avoid if pregnant or recovering from abdominal surgery.',
      cameraMode: 'floor_side',
      rules: { bowShapeCurvature: true, anklesHeld: true }
    },
    {
      id: 'ardha_matsyendrasana',
      sanskrit: 'Ardha Matsyendrasana',
      english: 'Half Spinal Twist',
      category: 'seated',
      difficulty: 'intermediate',
      target: 'Thoracic rotation, piriformis, obliques, neck',
      instructions: 'Sit tall with legs extended. Bend right knee, step right foot over outside of left knee. Bend left knee in. Inhale tall, exhale twist torso right, placing right hand behind.',
      benefits: 'Restores spinal rotational freedom, aids liver and kidney function.',
      safety: 'Initiate twist from thoracic spine, not from pulling neck.',
      cameraMode: 'floor_front',
      rules: { torsoTwistAngle: [40, 75], spineVertical: true }
    },
    {
      id: 'naukasana',
      sanskrit: 'Naukasana',
      english: 'Boat Pose',
      category: 'seated',
      difficulty: 'intermediate',
      target: 'Rectus abdominis, hip flexors, adductors, spine',
      instructions: 'Sit with knees bent, feet flat. Lean back slightly, lift feet off floor with shins parallel to mat (or legs straight). Extend arms forward parallel to ground.',
      benefits: 'Intense core builder, stimulates thyroid and intestines, improves balance.',
      safety: 'Bend knees if lower back begins to round or strain.',
      cameraMode: 'floor_side',
      rules: { vShapeAngle: [60, 95], armsParallel: true }
    },
    {
      id: 'pavanamuktasana',
      sanskrit: 'Pavanamuktasana',
      english: 'Wind-Relieving Pose',
      category: 'supine',
      difficulty: 'beginner',
      target: 'Lumbar spine decompression, digestive organs, hips',
      instructions: 'Lie supine. Exhale, draw both knees to chest, wrap arms around shins. Gently tuck chin toward chest. Breathe deeply into abdomen.',
      benefits: 'Massages internal abdominal organs, relieves bloating and gas, relaxes lumbar.',
      safety: 'Gentle hug; do not strain neck if lifting head.',
      cameraMode: 'floor_side',
      rules: { kneesToChest: true, supineFlat: true }
    },
    {
      id: 'viparita_karani',
      sanskrit: 'Viparita Karani',
      english: 'Legs-Up-the-Wall Pose',
      category: 'inversion',
      difficulty: 'beginner',
      target: 'Venous return, hamstrings, nervous system downregulation',
      instructions: 'Sit sideways against a wall, swing legs up onto wall while lowering torso flat onto mat. Rest arms open with palms facing upward. Breathe naturally.',
      benefits: 'Reduces leg swelling, relieves insomnia, lowers blood pressure.',
      safety: 'Place a folded bolster or blanket beneath lower back for extra comfort.',
      cameraMode: 'floor_side',
      rules: { legsVertical: true, torsoFlat: true }
    },
    {
      id: 'savasana',
      sanskrit: 'Savasana',
      english: 'Corpse Pose',
      category: 'supine',
      difficulty: 'beginner',
      target: 'Total neuromuscular release, parasympathetic activation',
      instructions: 'Lie flat on back, feet relaxed wider than hip distance, arms resting slightly away from body with palms facing ceiling. Close eyes and release all muscular effort.',
      benefits: 'Integrates practice benefits, reduces anxiety, drops cortisol levels.',
      safety: 'Place a rolled blanket under knees if lower back experiences stiffness.',
      cameraMode: 'floor_top_down',
      rules: { bodyCompletelyStill: true }
    },
    {
      id: 'uttanasana',
      sanskrit: 'Uttanasana',
      english: 'Standing Forward Bend',
      category: 'standing',
      difficulty: 'beginner',
      target: 'Hamstrings, calves, lumbar spine decompression',
      instructions: 'From Mountain Pose, exhale, hinge forward from hip joints (not waist). Lower hands to mat, ankles, or shins. Let neck and crown of head hang completely heavy.',
      benefits: 'Calms brain, relieves stress, stretches hamstrings and calves.',
      safety: 'Maintain generous bend in knees if hamstrings are tight.',
      cameraMode: 'full_body_side',
      rules: { forwardFoldTorsoAngle: [20, 60], standingLegStraightOrMicrobent: true }
    },
    {
      id: 'prasarita_padottanasana',
      sanskrit: 'Prasarita Padottanasana',
      english: 'Wide-Legged Forward Bend',
      category: 'standing',
      difficulty: 'intermediate',
      target: 'Adductors, hamstrings, thoracic spine, ankles',
      instructions: 'Step feet wide (~4.5 feet apart), outer edges of feet parallel to mat edges. Inhale lengthen spine; exhale fold forward from hips, resting palms on mat under shoulders.',
      benefits: 'Strengthens feet and legs, decompresses lumbar spine, cools nervous system.',
      safety: 'Do not hyperextend knees; distribute weight evenly through feet.',
      cameraMode: 'full_body_front',
      rules: { wideStanceRatio: true, foldedTorso: true }
    },
    {
      id: 'parsvakonasana',
      sanskrit: 'Parsvakonasana',
      english: 'Extended Side Angle Pose',
      category: 'standing',
      difficulty: 'intermediate',
      target: 'Ankles, quads, obliques, lats, chest opening',
      instructions: 'From Warrior II with right knee bent 90°, rest right forearm on right thigh or fingertips on floor. Sweep left arm up and forward alongside left ear, creating a straight diagonal line from left outer heel to fingertips.',
      benefits: 'Builds stamina, stretches lateral side body, opens chest.',
      safety: 'Avoid dumping all weight into bottom forearm; engage side waist.',
      cameraMode: 'full_body_front',
      rules: { diagonalBodyLine: true, frontKneeAngle: [85, 100] }
    },
    {
      id: 'garudasana',
      sanskrit: 'Garudasana',
      english: 'Eagle Pose',
      category: 'balance',
      difficulty: 'advanced',
      target: 'Shoulders, upper back, outer hips, ankles, balance',
      instructions: 'Bend both knees slightly. Cross right thigh over left, hook right toes behind left calf if accessible. Cross left arm over right at elbows, wrap forearms and press palms together. Sit hips down.',
      benefits: 'Opens posterior shoulder girdle, challenges balance, compresses & detoxifies joints.',
      safety: 'Keep big toe of lifted foot touching floor as a kickstand if balance is unsteady.',
      cameraMode: 'full_body_front',
      rules: { wrappedLimbs: true, balancedOnSingleFoot: true }
    },
    {
      id: 'gomukhasana',
      sanskrit: 'Gomukhasana',
      english: 'Cow Face Pose',
      category: 'seated',
      difficulty: 'intermediate',
      target: 'Rotator cuff, triceps, latissimus dorsi, outer hips',
      instructions: 'Sit with knees stacked directly on top of each other. Reach right arm overhead, bend elbow to drop hand behind neck. Reach left arm behind back and up, clasping fingers together between shoulder blades.',
      benefits: 'Deep shoulder opener, releases chronic upper back tension, stretches glutes.',
      safety: 'Hold a yoga strap or towel between hands if fingers do not comfortably touch.',
      cameraMode: 'seated_front',
      rules: { stackedKnees: true, handsClaspedBehind: true }
    },
    {
      id: 'ustrasana',
      sanskrit: 'Ustrasana',
      english: 'Camel Pose',
      category: 'seated',
      difficulty: 'intermediate',
      target: 'Hip flexors, quads, pectorals, throat, spinal mobility',
      instructions: 'Kneel with hips stacked over knees, tops of feet flat. Place hands on sacrum with fingers pointing down. Inhale, lift sternum toward ceiling, arch back gently and reach hands for heels.',
      benefits: 'Powerful backbend that improves spinal posture, opens respiratory capacity.',
      safety: 'Keep hips pushing forward over knees; do not dump into lower back.',
      cameraMode: 'floor_side',
      rules: { spineExtensionBackbend: true, hipsOverKnees: true }
    },
    {
      id: 'matsyasana',
      sanskrit: 'Matsyasana',
      english: 'Fish Pose',
      category: 'supine',
      difficulty: 'beginner',
      target: 'Chest, intercostals, anterior neck, upper spine',
      instructions: 'Lie supine with legs together. Slide hands palms-down beneath hips. Inhale, press forearms and elbows into mat, lift chest toward ceiling, arching upper back and resting crown of head lightly on mat.',
      benefits: 'Traditional counterpose to shoulder stand, relieves throat and bronchial tension.',
      safety: 'Weight must remain in forearms and elbows, NOT on neck or head.',
      cameraMode: 'floor_side',
      rules: { archedThoracicChest: true, forearmsGrounded: true }
    },
    {
      id: 'natarajasana',
      sanskrit: 'Natarajasana',
      english: 'Dancer Pose (Lord of the Dance)',
      category: 'balance',
      difficulty: 'advanced',
      target: 'Hamstrings, quads, hip flexors, shoulder mobility, balance',
      instructions: 'Shift weight to left foot. Bend right knee, catch inner right ankle with right hand. Inhale, extend left arm forward and up; exhale, kick right foot back and upward into hand while tilting torso forward.',
      benefits: 'Develops supreme balance, opens chest and hips, builds poise and strength.',
      safety: 'Square hips toward mat; avoid twisting pelvis sideways.',
      cameraMode: 'full_body_side',
      rules: { standingLegStraight: true, backLegKickedHigh: true }
    },
    {
      id: 'surya_namaskar',
      sanskrit: 'Surya Namaskar',
      english: 'Sun Salutation Sequence (12 Poses)',
      category: 'flow',
      difficulty: 'intermediate',
      target: 'Full body cardiovascular endurance, joint lubrication, flexibility',
      instructions: 'A complete classical dynamic sequence linking 12 poses: Pranamasana, Hastauttanasana, Padahastasana, Ashwa Sanchalanasana, Dandasana, Ashtanga Namaskara, Bhujangasana, Parvatasana, and returning.',
      benefits: 'Energizes full system, improves circulation, increases overall metabolic rate.',
      safety: 'Synchronize movement with breath (inhale for expansions, exhale for folds).',
      cameraMode: 'full_body_side',
      rules: { dynamicSequence: true }
    }
  ];

  // 2. Library of 20+ Fitness Exercises with Rep / Duration criteria
  const FITNESS_EXERCISES = [
    { id: 'ex_squats', name: 'Bodyweight Squats', target: 'Quadriceps, Glutes, Core', difficulty: 'beginner', type: 'reps', defaultReps: 15, sets: 3, rest: 45, estCal: 45, instructions: 'Stand shoulder-width apart. Sit hips back and down until thighs are parallel to ground. Keep chest up and knees tracking over toes.' },
    { id: 'ex_wall_pushups', name: 'Wall Push-ups', target: 'Chest, Shoulders, Triceps', difficulty: 'beginner', type: 'reps', defaultReps: 15, sets: 3, rest: 30, estCal: 25, instructions: 'Stand arm-length from a wall. Place palms flat at shoulder height. Lower chest towards wall, then press back.' },
    { id: 'ex_standard_pushups', name: 'Standard Push-ups', target: 'Pectorals, Triceps, Deltoids, Core', difficulty: 'intermediate', type: 'reps', defaultReps: 12, sets: 3, rest: 60, estCal: 50, instructions: 'In high plank with hands slightly wider than shoulders, lower chest until elbows reach 90 degrees, then push up.' },
    { id: 'ex_knee_pushups', name: 'Knee Push-ups', target: 'Chest, Arms, Core', difficulty: 'beginner', type: 'reps', defaultReps: 12, sets: 3, rest: 45, estCal: 35, instructions: 'Perform push-ups with knees on mat, keeping hips in a straight line with shoulders.' },
    { id: 'ex_lunges', name: 'Walking / Alternating Lunges', target: 'Quads, Glutes, Hamstrings, Calves', difficulty: 'intermediate', type: 'reps', defaultReps: 12, sets: 3, rest: 45, estCal: 55, instructions: 'Step forward with one leg, lowering hips until both knees are bent at roughly 90 degrees. Push back to starting position.' },
    { id: 'ex_reverse_lunges', name: 'Reverse Lunges', target: 'Glutes, Hamstrings, Knees stability', difficulty: 'beginner', type: 'reps', defaultReps: 12, sets: 3, rest: 45, estCal: 50, instructions: 'Step backward into a lunge. Reverse lunges place less shear stress on anterior knees.' },
    { id: 'ex_plank', name: 'Forearm Plank', target: 'Transverse Abdominis, Glutes, Shoulders', difficulty: 'beginner', type: 'timed', defaultDuration: 45, sets: 3, rest: 45, estCal: 40, instructions: 'Hold body in a straight line supported on forearms and toes. Keep glutes engaged.' },
    { id: 'ex_side_plank', name: 'Side Plank', target: 'Obliques, Quadratus Lumborum, Shoulders', difficulty: 'intermediate', type: 'timed', defaultDuration: 30, sets: 3, rest: 45, estCal: 35, instructions: 'Lie on side, propping upper body on elbow. Lift hips until body forms a straight diagonal line.' },
    { id: 'ex_glute_bridges', name: 'Glute Bridges', target: 'Gluteus Maximus, Hamstrings, Lower Back', difficulty: 'beginner', type: 'reps', defaultReps: 15, sets: 3, rest: 40, estCal: 40, instructions: 'Lie supine, knees bent, feet flat. Drive through heels to raise hips towards ceiling, squeezing glutes at top.' },
    { id: 'ex_hip_hinges', name: 'Bodyweight Hip Hinges (Good Mornings)', target: 'Hamstrings, Posterior Chain, Glutes', difficulty: 'beginner', type: 'reps', defaultReps: 15, sets: 3, rest: 40, estCal: 35, instructions: 'Hands behind head, push hips straight back while keeping back flat and knees softly unlocked.' },
    { id: 'ex_calf_raises', name: 'Standing Calf Raises', target: 'Gastrocnemius, Soleus, Ankles', difficulty: 'beginner', type: 'reps', defaultReps: 20, sets: 3, rest: 30, estCal: 30, instructions: 'Stand tall, press down through balls of feet to elevate heels as high as possible, then lower under control.' },
    { id: 'ex_bird_dog', name: 'Bird Dog', target: 'Core Stabilizers, Erector Spinae, Glutes', difficulty: 'beginner', type: 'reps', defaultReps: 12, sets: 3, rest: 40, estCal: 35, instructions: 'From tabletop, extend opposite arm and leg straight out parallel to floor. Hold 2 seconds, switch sides.' },
    { id: 'ex_dead_bug', name: 'Dead Bug', target: 'Deep Core, Pelvic Alignment', difficulty: 'beginner', type: 'reps', defaultReps: 12, sets: 3, rest: 40, estCal: 30, instructions: 'Lie supine, arms toward ceiling, knees bent at 90 degrees. Lower opposite arm and leg toward floor while pressing lower back down.' },
    { id: 'ex_mountain_climbers', name: 'Mountain Climbers', target: 'Core, Cardiovascular, Hip Flexors', difficulty: 'intermediate', type: 'timed', defaultDuration: 30, sets: 3, rest: 45, estCal: 60, instructions: 'From high plank, rapidly drive knees alternately toward chest in a running motion.' },
    { id: 'ex_jumping_jacks', name: 'Jumping Jacks', target: 'Full Body Aerobic Conditioning, Calves', difficulty: 'beginner', type: 'timed', defaultDuration: 45, sets: 3, rest: 30, estCal: 65, instructions: 'Jump feet wide while raising arms overhead, then jump back to center.' },
    { id: 'ex_high_knees', name: 'High Knees Running in Place', target: 'Hip Flexors, Quadriceps, Cardio', difficulty: 'intermediate', type: 'timed', defaultDuration: 30, sets: 3, rest: 45, estCal: 70, instructions: 'Run in place, driving knees up to hip height with pump of opposing arms.' },
    { id: 'ex_crunches', name: 'Controlled Core Crunches', target: 'Rectus Abdominis', difficulty: 'beginner', type: 'reps', defaultReps: 15, sets: 3, rest: 40, estCal: 30, instructions: 'Lie on back, feet on floor, curl shoulder blades off mat by contracting upper abs. Avoid pulling on neck.' },
    { id: 'ex_bicep_curls', name: 'Dumbbell / Resistance Band Biceps Curls', target: 'Biceps Brachii, Brachialis', difficulty: 'beginner', type: 'reps', defaultReps: 12, sets: 3, rest: 45, estCal: 35, instructions: 'Hold weights or band with palms forward. Curl upward towards shoulders while keeping elbows pinned to ribs.' },
    { id: 'ex_shoulder_press', name: 'Dumbbell Overhead Shoulder Press', target: 'Anterior & Lateral Deltoids, Triceps', difficulty: 'intermediate', type: 'reps', defaultReps: 10, sets: 3, rest: 60, estCal: 45, instructions: 'Press weights overhead from shoulder height until arms are fully extended, then lower with control.' },
    { id: 'ex_band_rows', name: 'Resistance Band Bent-Over Rows', target: 'Latissimus Dorsi, Rhomboids, Rear Delts', difficulty: 'beginner', type: 'reps', defaultReps: 15, sets: 3, rest: 45, estCal: 45, instructions: 'Step on band with feet, hinge at hips. Pull handles toward ribcage, squeezing shoulder blades together.' }
  ];

  // 3. Personalized 7-Day Plan Generator — EXACTLY 5 activities per day!
  function generateWeeklyPlan(experience = 'beginner', goal = 'fat_loss') {
    return [
      {
        day: 1,
        title: 'Day 1: Full-Body Mobility & Beginner Yoga',
        focus: 'Spinal mobility, joint lubrication & postural alignment',
        warmup: '5 mins gentle neck rolls, shoulder shrugs, and deep diaphragmatic breathing',
        cooldown: '5 mins Savasana with mindful body scan',
        activities: [
          { name: 'Tadasana (Mountain Pose)', type: 'yoga', duration: '3 mins', reps: '5 deep breath cycles', estCal: 15, muscles: 'Postural stabilizers', difficulty: 'beginner', sub: 'Sukhasana', instructions: 'Root through all 4 corners of both feet, engage thighs, lengthen spine tall.' },
          { name: 'Marjaryasana & Bitilasana (Cat-Cow Flow)', type: 'yoga', duration: '4 mins', reps: '10 breath cycles', estCal: 25, muscles: 'Spine, core, neck', difficulty: 'beginner', sub: 'Bird Dog', instructions: 'Inhale arch back (Cow), exhale round spine to ceiling (Cat).' },
          { name: 'Adho Mukha Svanasana (Downward-Facing Dog)', type: 'yoga', duration: '4 mins', reps: '3 holds x 45s', estCal: 30, muscles: 'Shoulders, calves, hamstrings', difficulty: 'beginner', sub: 'Wall Push-ups', instructions: 'Press hands firmly into mat, elevate hips high into inverted V shape.' },
          { name: 'Vrikshasana (Tree Pose)', type: 'yoga', duration: '4 mins', reps: '45s each leg', estCal: 20, muscles: 'Ankles, core, balance', difficulty: 'beginner', sub: 'Tadasana Variation', instructions: 'Place foot on calf or thigh; focus gaze on an unmoving spot.' },
          { name: 'Balasana (Child’s Pose)', type: 'yoga', duration: '5 mins', reps: 'Hold restorative', estCal: 15, muscles: 'Lower back, hips', difficulty: 'beginner', sub: 'Pavanamuktasana', instructions: 'Rest hips back on heels, forehead on floor, breathe deeply.' }
        ]
      },
      {
        day: 2,
        title: 'Day 2: Lower-Body Strength & Hip Flexibility',
        focus: 'Quadriceps, hamstrings, glute activation & adductor release',
        warmup: '4 mins leg swings, ankle circles, and bodyweight hip openers',
        cooldown: '4 mins Baddha Konasana (Butterfly stretch) and quad stretch',
        activities: [
          { name: 'Bodyweight Squats', type: 'exercise', duration: '6 mins', reps: '3 sets x 15 reps', estCal: 55, muscles: 'Quads, glutes', difficulty: 'beginner', sub: 'Wall Sit', instructions: 'Hips back and down to knee height, chest elevated, drive through mid-foot.' },
          { name: 'Reverse Lunges', type: 'exercise', duration: '6 mins', reps: '3 sets x 12 reps/leg', estCal: 50, muscles: 'Glutes, hamstrings', difficulty: 'beginner', sub: 'Glute Bridges', instructions: 'Step backward smoothly, dropping back knee toward mat.' },
          { name: 'Glute Bridges', type: 'exercise', duration: '5 mins', reps: '3 sets x 15 reps', estCal: 45, muscles: 'Gluteus maximus, hamstrings', difficulty: 'beginner', sub: 'Setu Bandhasana', instructions: 'Press heels down to bridge hips up, squeeze glutes at peak.' },
          { name: 'Virabhadrasana II (Warrior II)', type: 'yoga', duration: '5 mins', reps: '3 holds x 45s per side', estCal: 35, muscles: 'Hips, adductors, legs', difficulty: 'beginner', sub: 'Anjaneyasana', instructions: 'Deep 90-degree front knee bend, arms extended horizontally.' },
          { name: 'Malasana (Garland Pose Deep Squat)', type: 'yoga', duration: '4 mins', reps: '3 holds x 45s', estCal: 25, muscles: 'Pelvic floor, groin, ankles', difficulty: 'beginner', sub: 'Baddha Konasana', instructions: 'Deep squat with elbows nudging inner knees open, spine long.' }
        ]
      },
      {
        day: 3,
        title: 'Day 3: Upper-Body Strength & Posture',
        focus: 'Pectorals, rhomboids, shoulders & thoracic opening',
        warmup: '4 mins arm circles, wrist rolls, and doorway chest stretches',
        cooldown: '4 mins Gomukhasana shoulder stretch & child’s pose',
        activities: [
          { name: 'Standard or Knee Push-ups', type: 'exercise', duration: '6 mins', reps: '3 sets x 10–12 reps', estCal: 50, muscles: 'Chest, triceps, anterior delts', difficulty: 'intermediate', sub: 'Wall Push-ups', instructions: 'Keep body in rigid plank, lower chest to floor, push back up.' },
          { name: 'Forearm Plank', type: 'exercise', duration: '5 mins', reps: '3 sets x 40s hold', estCal: 40, muscles: 'Core, shoulders', difficulty: 'beginner', sub: 'Phalakasana', instructions: 'Straight line head to heels, avoid sagging or hiking hips.' },
          { name: 'Resistance Band Rows / Hip Hinges', type: 'exercise', duration: '6 mins', reps: '3 sets x 12 reps', estCal: 45, muscles: 'Upper back, lats, posterior chain', difficulty: 'beginner', sub: 'Bird Dog', instructions: 'Pull elbows back past ribs, pinch shoulder blades together.' },
          { name: 'Bhujangasana (Cobra Pose)', type: 'yoga', duration: '4 mins', reps: '4 holds x 30s', estCal: 25, muscles: 'Erector spinae, chest', difficulty: 'beginner', sub: 'Salabhasana', instructions: 'Press tops of feet down, peel chest forward and up using back muscles.' },
          { name: 'Ustrasana (Camel Pose)', type: 'yoga', duration: '5 mins', reps: '3 holds x 30s', estCal: 25, muscles: 'Chest, shoulders, hip flexors', difficulty: 'intermediate', sub: 'Setu Bandhasana', instructions: 'From kneeling, support lower back or reach heels, expand chest.' }
        ]
      },
      {
        day: 4,
        title: 'Day 4: Recovery Yoga, Balance & Breathing',
        focus: 'Parasympathetic recovery, balance proprioception & stress relief',
        warmup: '5 mins gentle Sukhasana seated breathing (Pranayama)',
        cooldown: '6 mins Savasana with slow ocean breath (Ujjayi)',
        activities: [
          { name: 'Sukhasana & Pranayama Breathing', type: 'yoga', duration: '5 mins', reps: 'Mindful practice', estCal: 15, muscles: 'Respiratory muscles, nervous system', difficulty: 'beginner', sub: 'Vajrasana', instructions: 'Sit tall, slow rhythmic 4-second inhales and 6-second exhales.' },
          { name: 'Vrikshasana with Raised Arms', type: 'yoga', duration: '5 mins', reps: '45s per side x 2', estCal: 20, muscles: 'Ankle stabilizers, balance', difficulty: 'intermediate', sub: 'Tadasana', instructions: 'Raise arms overhead like tree branches while balancing on one leg.' },
          { name: 'Paschimottanasana (Seated Forward Bend)', type: 'yoga', duration: '5 mins', reps: '3 holds x 60s', estCal: 20, muscles: 'Hamstrings, back chain', difficulty: 'beginner', sub: 'Uttanasana', instructions: 'Fold forward from hips toward toes, keeping spine lengthened.' },
          { name: 'Ardha Matsyendrasana (Half Spinal Twist)', type: 'yoga', duration: '5 mins', reps: '45s each side x 2', estCal: 20, muscles: 'Obliques, thoracic spine', difficulty: 'intermediate', sub: 'Marjaryasana', instructions: 'Twist gently through upper back, breathing space into vertebrae.' },
          { name: 'Viparita Karani (Legs-Up-the-Wall Pose)', type: 'yoga', duration: '6 mins', reps: 'Restorative hold', estCal: 15, muscles: 'Circulatory, nervous system', difficulty: 'beginner', sub: 'Pavanamuktasana', instructions: 'Elevate legs vertically up against wall, surrender all muscular effort.' }
        ]
      },
      {
        day: 5,
        title: 'Day 5: Full-Body Strength & Core',
        focus: 'Multi-joint strength, core endurance & metabolic stimulus',
        warmup: '5 mins jumping jacks, torso twists, and high plank holds',
        cooldown: '4 mins Cobra to Child’s Pose transition',
        activities: [
          { name: 'Mountain Climbers', type: 'exercise', duration: '5 mins', reps: '3 sets x 30s', estCal: 60, muscles: 'Core, hip flexors, cardio', difficulty: 'intermediate', sub: 'High Knees', instructions: 'From high plank, drive knees forward toward chest rhythmically.' },
          { name: 'Bodyweight Squats to Calf Raises', type: 'exercise', duration: '6 mins', reps: '3 sets x 15 reps', estCal: 55, muscles: 'Quads, glutes, calves', difficulty: 'beginner', sub: 'Squats', instructions: 'Perform a squat and explode onto toes at top of movement.' },
          { name: 'Side Plank Holds', type: 'exercise', duration: '5 mins', reps: '3 sets x 30s each side', estCal: 35, muscles: 'Obliques, transverse abdominis', difficulty: 'intermediate', sub: 'Forearm Plank', instructions: 'Elevate hips to form straight diagonal line from shoulder to ankles.' },
          { name: 'Bird Dog & Dead Bug Combo', type: 'exercise', duration: '5 mins', reps: '3 sets x 12 reps', estCal: 35, muscles: 'Deep core stabilizers', difficulty: 'beginner', sub: 'Crunches', instructions: 'Move opposite arm and leg in controlled, deliberate cadence.' },
          { name: 'Phalakasana to Chaturanga Flow', type: 'yoga', duration: '5 mins', reps: '5 controlled descents', estCal: 45, muscles: 'Chest, triceps, anterior core', difficulty: 'advanced', sub: 'Knee Push-ups', instructions: 'From plank, slowly lower body with elbows pinned to ribs.' }
        ]
      },
      {
        day: 6,
        title: 'Day 6: Yoga Flow, Flexibility & Light Cardio',
        focus: 'Dynamic movement chains, cardiovascular flow & hip opening',
        warmup: '4 mins gentle spinal ripples and arm sweeps',
        cooldown: '5 mins Supta Baddha Konasana (Reclined Bound Angle)',
        activities: [
          { name: 'Surya Namaskar (Sun Salutations)', type: 'yoga', duration: '8 mins', reps: '4 full rounds', estCal: 70, muscles: 'Full body continuous chain', difficulty: 'intermediate', sub: 'Downward Dog flow', instructions: 'Link breath with movement through the classical 12-pose sequence.' },
          { name: 'Trikonasana (Triangle Pose)', type: 'yoga', duration: '5 mins', reps: '3 holds x 45s per side', estCal: 30, muscles: 'Hamstrings, lateral obliques', difficulty: 'intermediate', sub: 'Warrior II', instructions: 'Hinge at hip crease, reach top arm high, expand chest open.' },
          { name: 'Anjaneyasana (Low Lunge)', type: 'yoga', duration: '5 mins', reps: '45s hold per leg x 2', estCal: 30, muscles: 'Psoas, hip flexors, quads', difficulty: 'beginner', sub: 'Warrior I', instructions: 'Drop back knee to mat, sweep arms high, sink hips gently.' },
          { name: 'High Knees or Jumping Jacks', type: 'exercise', duration: '4 mins', reps: '3 intervals x 40s', estCal: 60, muscles: 'Cardiovascular, agility', difficulty: 'beginner', sub: 'Calf Raises', instructions: 'Maintain brisk, rhythmic tempo to elevate heart rate.' },
          { name: 'Natarajasana (Dancer Pose)', type: 'yoga', duration: '5 mins', reps: '30s hold per side x 2', estCal: 30, muscles: 'Posterior chain, balance, chest', difficulty: 'advanced', sub: 'Warrior III', instructions: 'Catch inner ankle, kick foot upward while reaching opposite arm forward.' }
        ]
      },
      {
        day: 7,
        title: 'Day 7: Gentle Recovery, Stretching & Review',
        focus: 'Neuromuscular reset, reflection, myofascial release & readiness',
        warmup: '5 mins gentle pacing and slow diaphragmatic breathing',
        cooldown: '7 mins meditative Corpse Pose (Savasana)',
        activities: [
          { name: 'Uttanasana (Standing Forward Bend)', type: 'yoga', duration: '4 mins', reps: '3 holds x 45s', estCal: 20, muscles: 'Hamstrings, spinal extensors', difficulty: 'beginner', sub: 'Seated Fold', instructions: 'Hinge from hips, let spine and head hang completely loose.' },
          { name: 'Setu Bandhasana (Bridge Pose)', type: 'yoga', duration: '5 mins', reps: '3 holds x 45s', estCal: 30, muscles: 'Glutes, lower back, chest', difficulty: 'beginner', sub: 'Glute Bridges', instructions: 'Lift hips with feet grounded, open chest and heart toward chin.' },
          { name: 'Pavanamuktasana (Wind-Relieving Pose)', type: 'yoga', duration: '4 mins', reps: 'Hold 2 mins', estCal: 15, muscles: 'Lumbar, digestive viscera', difficulty: 'beginner', sub: 'Child’s Pose', instructions: 'Hug knees tightly to chest, gently rock side to side.' },
          { name: 'Baddha Konasana (Bound Angle)', type: 'yoga', duration: '5 mins', reps: 'Hold 3 mins', estCal: 15, muscles: 'Groin, inner thighs', difficulty: 'beginner', sub: 'Sukhasana', instructions: 'Soles of feet together, sit tall, allow knees to open naturally.' },
          { name: 'Savasana (Corpse Pose)', type: 'yoga', duration: '8 mins', reps: 'Deep surrender', estCal: 10, muscles: 'Full body parasympathetic', difficulty: 'beginner', sub: 'Viparita Karani', instructions: 'Lie completely still, close eyes, release all muscular tension.' }
        ]
      }
    ];
  }

  return {
    YOGA_POSES,
    FITNESS_EXERCISES,
    generateWeeklyPlan
  };
})();


// ========================================================
// MODULE: js/pose.js
// ========================================================
// public/js/pose.js
// Live AI Yoga & Exercise Tracking using MediaPipe Pose Landmarker
// Features: Real-time joint angle trigonometry, live posture feedback, audio/voice cues, session logging

const PoseTracker = (() => {
  let videoElement = null;
  let canvasElement = null;
  let canvasCtx = null;
  let mediaPipePose = null;
  let cameraStream = null;
  let animationFrameId = null;

  // State
  let isRunning = false;
  let isPaused = false;
  let activePose = null;
  let facingMode = 'user'; // 'user' or 'environment'
  let isMirrored = true;
  let voiceEnabled = true;
  let soundEnabled = true;

  // Session Stats
  let sessionStartTime = null;
  let poseHoldStartTime = null;
  let totalHoldSeconds = 0;
  let accuracySamples = [];
  let completedPosesCount = 0;
  let lastSpokenFeedback = '';
  let lastSpokenTime = 0;

  // Audio Context for sound cues
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playTone(freq = 440, type = 'sine', duration = 0.15) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function speakFeedback(text) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    const now = Date.now();
    // Throttle voice to avoid overlapping chatter
    if (text === lastSpokenFeedback && now - lastSpokenTime < 5000) return;
    if (now - lastSpokenTime < 3000) return;

    lastSpokenFeedback = text;
    lastSpokenTime = now;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.85;
    window.speechSynthesis.speak(utterance);
  }

  // 1. Calculate Angle (in degrees) between three landmarks: A, B (vertex), C
  function calculateAngle(a, b, c) {
    if (!a || !b || !c) return 0;
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360.0 - angle;
    }
    return Math.round(angle);
  }

  // 2. Initialize MediaPipe Pose Instance
  function initMediaPipe() {
    if (window.Pose) {
      mediaPipePose = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });
      mediaPipePose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });
      mediaPipePose.onResults(onPoseResults);
      console.log('✅ MediaPipe Pose initialized in VIDEO mode.');
    } else {
      console.warn('MediaPipe Pose script not loaded yet, camera stream will still preview.');
    }
  }

  // 3. Start Camera Session
  async function startSession(poseId, videoEl, canvasEl, onStatusUpdate) {
    videoElement = videoEl;
    canvasElement = canvasEl;
    canvasCtx = canvasElement.getContext('2d');
    statusCallback = onStatusUpdate;

    activePose = Workouts.YOGA_POSES.find(p => p.id === poseId) || Workouts.YOGA_POSES[0];
    sessionStartTime = Date.now();
    poseHoldStartTime = null;
    totalHoldSeconds = 0;
    accuracySamples = [];
    completedPosesCount = 0;
    isRunning = true;
    isPaused = false;

    initAudio();
    if (!mediaPipePose) initMediaPipe();

    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = cameraStream;
      await videoElement.play();

      if (isMirrored && facingMode === 'user') {
        videoElement.classList.remove('unmirrored');
      } else {
        videoElement.classList.add('unmirrored');
      }

      startProcessingLoop();
      playTone(660, 'sine', 0.2);
      speakFeedback(`Starting ${activePose.english}. Position your full body in view.`);
      return { success: true };
    } catch (err) {
      console.error('Camera permission or device error:', err);
      let message = 'Unable to access camera. Please grant camera permissions in your browser settings.';
      if (err.name === 'NotAllowedError') {
        message = 'Camera permission denied. Please allow camera access in your browser bar.';
      } else if (err.name === 'NotFoundError') {
        message = 'No camera found on this device.';
      }
      return { success: false, error: message };
    }
  }

  // 4. Processing Loop
  function startProcessingLoop() {
    async function step() {
      if (!isRunning) return;
      if (!isPaused && videoElement && videoElement.readyState >= 2) {
        if (mediaPipePose) {
          await mediaPipePose.send({ image: videoElement });
        } else {
          // Fallback simple draw
          drawFallbackPreview();
        }
      }
      animationFrameId = requestAnimationFrame(step);
    }
    animationFrameId = requestAnimationFrame(step);
  }

  // 5. Landmark Processing & Posture Rule Evaluation
  let statusCallback = null;

  function onPoseResults(results) {
    if (!isRunning || !canvasElement || !canvasCtx) return;

    // Match canvas dimensions to video
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (!results.poseLandmarks) {
      notifyStatus({
        status: 'unable_to_assess',
        message: 'No person detected. Step into camera view.',
        score: 0
      });
      canvasCtx.restore();
      return;
    }

    const lm = results.poseLandmarks;

    // Key Landmark indices
    // 11: left shoulder, 12: right shoulder
    // 13: left elbow, 14: right elbow
    // 15: left wrist, 16: right wrist
    // 23: left hip, 24: right hip
    // 25: left knee, 26: right knee
    // 27: left ankle, 28: right ankle
    const leftShoulder = lm[11], rightShoulder = lm[12];
    const leftElbow = lm[13], rightElbow = lm[14];
    const leftWrist = lm[15], rightWrist = lm[16];
    const leftHip = lm[23], rightHip = lm[24];
    const leftKnee = lm[25], rightKnee = lm[26];
    const leftAnkle = lm[27], rightAnkle = lm[28];

    // Visibility Check: Ensure essential landmarks are in frame
    const essential = [leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee];
    const avgVis = essential.reduce((sum, p) => sum + (p?.visibility || 0), 0) / essential.length;

    if (avgVis < 0.5) {
      notifyStatus({
        status: 'unable_to_assess',
        message: 'Step further back so your full body from head to knees is visible.',
        score: Math.round(avgVis * 100)
      });
      drawSkeleton(lm, canvasCtx, '#64748b');
      canvasCtx.restore();
      return;
    }

    // Evaluate Active Pose Rules
    const evalResult = evaluatePose(activePose.id, {
      leftShoulder, rightShoulder,
      leftElbow, rightElbow,
      leftWrist, rightWrist,
      leftHip, rightHip,
      leftKnee, rightKnee,
      leftAnkle, rightAnkle
    });

    accuracySamples.push(evalResult.score);

    // Color code skeleton based on posture correctness
    let skeletonColor = '#ef4444'; // Red
    if (evalResult.status === 'correct') {
      skeletonColor = '#10e759'; // Neon lime
      if (!poseHoldStartTime) poseHoldStartTime = Date.now();
      totalHoldSeconds = Math.round((Date.now() - poseHoldStartTime) / 1000);
      if (totalHoldSeconds % 5 === 0 && totalHoldSeconds > 0) {
        playTone(880, 'sine', 0.15); // Celebration chime
      }
    } else {
      poseHoldStartTime = null;
      skeletonColor = evalResult.status === 'needs_adjustment' ? '#f59e0b' : '#ef4444';
    }

    drawSkeleton(lm, canvasCtx, skeletonColor);
    drawJointAngles(canvasCtx, evalResult.angles);

    notifyStatus({
      ...evalResult,
      holdSeconds: totalHoldSeconds
    });

    if (evalResult.cue) {
      speakFeedback(evalResult.cue);
    }

    canvasCtx.restore();
  }

  // 6. Pose Specific Alignment Rules Engine
  function evaluatePose(poseId, lms) {
    const { leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle } = lms;

    // Angle Calculations
    const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    const leftHipAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
    const rightHipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);
    const leftShoulderAngle = calculateAngle(leftElbow, leftShoulder, leftHip);
    const rightShoulderAngle = calculateAngle(rightElbow, rightShoulder, rightHip);

    const angles = {
      leftKnee: { angle: leftKneeAngle, point: leftKnee },
      rightKnee: { angle: rightKneeAngle, point: rightKnee },
      leftElbow: { angle: leftElbowAngle, point: leftElbow },
      rightElbow: { angle: rightElbowAngle, point: rightElbow }
    };

    let status = 'needs_adjustment';
    let message = 'Adjusting posture...';
    let cue = '';
    let score = 70;

    switch (poseId) {
      case 'tadasana': // Mountain Pose: Straight vertical legs, upright spine
        if (leftKneeAngle > 165 && rightKneeAngle > 165) {
          const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
          if (shoulderDiff < 0.05) {
            status = 'correct';
            message = 'Excellent alignment! Standing tall with spine erect.';
            score = 96;
          } else {
            message = 'Level your shoulders and draw your shoulder blades back.';
            cue = 'Level your shoulders.';
            score = 80;
          }
        } else {
          message = 'Straighten both knees without hyperextending.';
          cue = 'Straighten your knees.';
          score = 65;
        }
        break;

      case 'vrikshasana': // Tree Pose: One standing leg straight, one knee bent wide
        const isRightLifted = rightKneeAngle < 110;
        const isLeftLifted = leftKneeAngle < 110;

        if (isRightLifted && leftKneeAngle > 160) {
          status = 'correct';
          message = 'Great balance! Right knee open, standing tall.';
          cue = 'Hold this pose.';
          score = 94;
        } else if (isLeftLifted && rightKneeAngle > 160) {
          status = 'correct';
          message = 'Great balance! Left knee open, standing tall.';
          cue = 'Hold this pose.';
          score = 94;
        } else {
          message = 'Lift one foot to your inner calf or thigh. Keep standing leg firm.';
          cue = 'Open lifted knee to the side.';
          score = 68;
        }
        break;

      case 'virabhadrasana_2': // Warrior II: Front knee 90 deg, arms horizontal
        const isRightFront = rightKneeAngle < 125 && leftKneeAngle > 155;
        const isLeftFront = leftKneeAngle < 125 && rightKneeAngle > 155;

        if (isRightFront || isLeftFront) {
          const frontAngle = isRightFront ? rightKneeAngle : leftKneeAngle;
          const armsLevel = Math.abs(leftShoulderAngle - 90) < 30 && Math.abs(rightShoulderAngle - 90) < 30;

          if (frontAngle >= 85 && frontAngle <= 110 && armsLevel) {
            status = 'correct';
            message = 'Perfect Warrior II! Front knee over ankle, arms parallel to floor.';
            cue = 'Hold this strong pose.';
            score = 98;
          } else if (frontAngle > 110) {
            message = 'Sink deeper into your front hip to reach a 90° angle.';
            cue = 'Sink hips slightly lower.';
            score = 80;
          } else if (!armsLevel) {
            message = 'Raise both arms parallel to the floor at shoulder height.';
            cue = 'Raise your arms parallel.';
            score = 78;
          }
        } else {
          message = 'Step feet wider. Bend your front knee and keep back leg straight.';
          cue = 'Move your feet a little wider.';
          score = 65;
        }
        break;

      case 'trikonasana': // Triangle Pose: Straight legs, torso laterally tilted
        const legsStraight = leftKneeAngle > 160 && rightKneeAngle > 160;
        if (legsStraight) {
          status = 'correct';
          message = 'Excellent Triangle Pose! Chest open, legs lengthened.';
          cue = 'Hold this pose.';
          score = 92;
        } else {
          message = 'Keep both legs lengthened. Lengthen spine from hip crease.';
          cue = 'Straighten your front knee.';
          score = 72;
        }
        break;

      case 'utkatasana': // Chair Pose: Both knees bent 90-120, torso tilted
        if (leftKneeAngle < 135 && rightKneeAngle < 135 && leftKneeAngle > 75) {
          status = 'correct';
          message = 'Strong Chair Pose! Weight back in heels, arms reaching up.';
          score = 94;
        } else {
          message = 'Sit hips back deeper as if into a chair.';
          cue = 'Sit your hips lower.';
          score = 70;
        }
        break;

      case 'phalakasana': // Plank: Straight diagonal line from head to ankles
        const hipsLevel = Math.abs(leftHipAngle - 180) < 25 && Math.abs(rightHipAngle - 180) < 25;
        if (hipsLevel && leftKneeAngle > 160) {
          status = 'correct';
          message = 'Solid Plank form! Spine and hips in a straight line.';
          score = 95;
        } else if (leftHipAngle < 155) {
          message = 'Lower your hips to avoid peaking into an inverted V.';
          cue = 'Lower your hips slightly.';
          score = 75;
        } else {
          message = 'Engage your core to prevent hips from sagging.';
          cue = 'Engage your core.';
          score = 70;
        }
        break;

      case 'adho_mukha_svanasana': // Downward Dog: Inverted V, arms straight
        if (leftHipAngle < 110 && rightHipAngle < 110 && leftElbowAngle > 155) {
          status = 'correct';
          message = 'Great Downward Dog! Hips high, spine lengthened.';
          score = 94;
        } else {
          message = 'Press chest gently toward thighs and lift sit bones high.';
          cue = 'Lift hips toward the ceiling.';
          score = 74;
        }
        break;

      case 'bhujangasana': // Cobra Pose: Chest lifted, elbows bent, prone
      case 'setu_bandhasana': // Bridge Pose: Hips elevated
      default:
        // Default intelligent alignment evaluator for all other supported poses
        if (leftKneeAngle > 150 && rightKneeAngle > 150) {
          status = 'correct';
          message = `Good form! Holding ${activePose.english}.`;
          score = 88;
        } else {
          status = 'needs_adjustment';
          message = `Maintain alignment for ${activePose.english}. Breathe steadily.`;
          score = 76;
        }
        break;
    }

    return { status, message, cue, score, angles };
  }

  // 7. Render Skeleton Overlay on Canvas
  const POSE_CONNECTIONS = [
    [11, 12], [11, 13], [13, 15], // Left arm
    [12, 14], [14, 16],           // Right arm
    [11, 23], [12, 24],           // Torso sides
    [23, 24],                     // Pelvis
    [23, 25], [25, 27],           // Left leg
    [24, 26], [26, 28]            // Right leg
  ];

  function drawSkeleton(landmarks, ctx, color) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    // Draw Bone Lines
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';

    for (const [i, j] of POSE_CONNECTIONS) {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      if (p1 && p2 && p1.visibility > 0.4 && p2.visibility > 0.4) {
        ctx.beginPath();
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
        ctx.stroke();
      }
    }

    // Draw Joint Dots
    for (let i = 11; i <= 28; i++) {
      const p = landmarks[i];
      if (p && p.visibility > 0.4) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();
      }
    }
  }

  function drawJointAngles(ctx, angles) {
    if (!angles) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    for (const key in angles) {
      const item = angles[key];
      if (item.point && item.point.visibility > 0.5) {
        const x = item.point.x * w;
        const y = item.point.y * h - 12;
        ctx.fillStyle = 'rgba(10, 14, 22, 0.75)';
        ctx.fillRect(x - 20, y - 12, 40, 16);
        ctx.fillStyle = '#10e759';
        ctx.fillText(`${item.angle}°`, x, y);
      }
    }
  }

  function drawFallbackPreview() {
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  }

  function notifyStatus(data) {
    if (statusCallback) statusCallback(data);
  }

  // Session Control Functions
  function pauseSession() {
    isPaused = true;
  }

  function resumeSession() {
    isPaused = false;
  }

  function switchCamera() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    isMirrored = facingMode === 'user';
    if (isRunning) {
      stopCameraStream();
      startSession(activePose.id, videoElement, canvasElement, statusCallback);
    }
  }

  function toggleMirror() {
    isMirrored = !isMirrored;
    if (videoElement) {
      if (isMirrored) videoElement.classList.remove('unmirrored');
      else videoElement.classList.add('unmirrored');
    }
  }

  function toggleVoice() {
    voiceEnabled = !voiceEnabled;
    return voiceEnabled;
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    return soundEnabled;
  }

  function selectPose(poseId) {
    const p = Workouts.YOGA_POSES.find(x => x.id === poseId);
    if (p) {
      activePose = p;
      poseHoldStartTime = null;
      totalHoldSeconds = 0;
      speakFeedback(`Switched to ${activePose.english}`);
    }
  }

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
  }

  function stopSession() {
    isRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    stopCameraStream();

    const durationSeconds = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
    const avgScore = accuracySamples.length > 0
      ? Math.round(accuracySamples.reduce((a, b) => a + b, 0) / accuracySamples.length)
      : 85;

    // Estimate calories burned: ~4.5 MET for yoga, (MET * 3.5 * weightKg) / 200 * mins
    const profile = Auth.loadProfile() || { weight: 70 };
    const weightKg = profile.weight || 70;
    const durationMins = durationSeconds / 60;
    const caloriesBurned = Math.round((4.0 * 3.5 * weightKg / 200) * durationMins);

    // Save session
    const summary = {
      poseName: activePose ? activePose.english : 'Yoga Session',
      durationSeconds,
      accuracyScore: avgScore,
      caloriesBurned: Math.max(12, caloriesBurned),
      holdSeconds: totalHoldSeconds
    };

    const token = Auth.getAuthToken();
    if (token) {
      fetch('/api/profile/workout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          session_type: 'yoga',
          duration_seconds: durationSeconds,
          calories_burned: summary.caloriesBurned,
          poses_completed: 1,
          accuracy_score: avgScore
        })
      }).catch(e => console.warn('Workout sync offline:', e));
    }

    return summary;
  }

  return {
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    switchCamera,
    toggleMirror,
    toggleVoice,
    toggleSound,
    selectPose,
    getActivePose: () => activePose
  };
})();


// ========================================================
// MODULE: js/dashboard.js
// ========================================================
// public/js/dashboard.js
// Home Dashboard, Consistency Tracking & Native Canvas Analytics Charts

const Dashboard = (() => {
  // Render Dashboard Overview
  function render() {
    const profile = Auth.loadProfile() || {};
    const nameEl = document.getElementById('dash-user-name');
    if (nameEl) nameEl.textContent = profile.name || 'Athlete';

    // 1. Calorie & Macro Calculations
    const bmr = Calories.calculateBMR(profile.weight || 70, profile.height || 175, profile.age || 26, profile.sex || 'male');
    const tdee = Calories.calculateTDEE(bmr, profile.activity_level || 'moderate');
    const targetCalc = Calories.calculateTargets(tdee, profile.fitness_goal || 'fat_loss', profile.sex || 'male', profile.age || 26);
    const targetCalories = targetCalc.targetCalories;

    const nutrientTotals = Nutrition.getDailyNutrientTotals();
    const consumedCalories = nutrientTotals.calories;
    const remainingCalories = Math.max(0, targetCalories - consumedCalories);
    const calPercent = Math.min(100, Math.round((consumedCalories / targetCalories) * 100));

    // Update Calorie Card UI
    const targetCalEl = document.getElementById('dash-cal-target');
    const consumedCalEl = document.getElementById('dash-cal-consumed');
    const remainCalEl = document.getElementById('dash-cal-remaining');
    const calBarEl = document.getElementById('dash-cal-bar');

    if (targetCalEl) targetCalEl.textContent = targetCalories.toLocaleString();
    if (consumedCalEl) consumedCalEl.textContent = consumedCalories.toLocaleString();
    if (remainCalEl) remainCalEl.textContent = remainingCalories.toLocaleString();
    if (calBarEl) calBarEl.style.width = `${calPercent}%`;

    // Update Macros
    const macrosTarget = Calories.calculateMacros(targetCalories, profile.weight || 70, profile.fitness_goal || 'fat_loss');
    updateMacroPill('dash-macro-protein', nutrientTotals.protein, macrosTarget.protein.grams, 'g');
    updateMacroPill('dash-macro-carbs', nutrientTotals.carbs, macrosTarget.carbs.grams, 'g');
    updateMacroPill('dash-macro-fat', nutrientTotals.fat, macrosTarget.fat.grams, 'g');

    // 2. Hydration Snapshot
    const waterTarget = Water.getDailyTarget();
    const waterConsumed = Water.getTodayTotal();
    const waterPercent = Math.min(100, Math.round((waterConsumed / waterTarget) * 100));

    const waterAmountEl = document.getElementById('dash-water-amount');
    const waterTargetEl = document.getElementById('dash-water-target');
    const waterBarEl = document.getElementById('dash-water-bar');
    if (waterAmountEl) waterAmountEl.textContent = `${waterConsumed} ml`;
    if (waterTargetEl) waterTargetEl.textContent = `${waterTarget} ml`;
    if (waterBarEl) waterBarEl.style.width = `${waterPercent}%`;

    // 3. Weight Goal Snapshot
    const currentWeightEl = document.getElementById('dash-weight-current');
    const targetWeightEl = document.getElementById('dash-weight-target');
    const bmiValueEl = document.getElementById('dash-bmi-val');
    const bmiBadgeEl = document.getElementById('dash-bmi-badge');

    if (currentWeightEl) currentWeightEl.textContent = `${profile.weight || '--'} kg`;
    if (targetWeightEl) targetWeightEl.textContent = `${profile.target_weight || '--'} kg`;

    const bmiData = Calories.calculateBMI(profile.weight, profile.height);
    if (bmiData && bmiValueEl && bmiBadgeEl) {
      bmiValueEl.textContent = bmiData.bmi;
      bmiBadgeEl.textContent = bmiData.category;
      bmiBadgeEl.style.color = bmiData.color;
    }

    // 4. Today's 5 Planned Activities
    renderTodayWorkoutActivities();

    // 5. Render Canvas Analytics Charts
    renderWeightChart();
    renderConsistencyChart();
  }

  function updateMacroPill(elementId, consumed, target, unit) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
        <span style="font-weight:600; text-transform:capitalize;">${elementId.replace('dash-macro-', '')}</span>
        <span style="color:var(--text-secondary);">${consumed} / ${target}${unit}</span>
      </div>
      <div class="progress-bar-bg" style="height:6px;">
        <div class="progress-bar-fill fill-lime" style="width:${pct}%"></div>
      </div>
    `;
  }

  // Render Today's 5 Activities on Home Screen
  function renderTodayWorkoutActivities() {
    const container = document.getElementById('dash-today-activities');
    if (!container) return;

    const weeklyPlan = Workouts.generateWeeklyPlan();
    // Default to day 1 or current day of week (1..7)
    const todayIndex = new Date().getDay() || 7; // 1 = Monday ... 7 = Sunday
    const dayPlan = weeklyPlan[todayIndex - 1] || weeklyPlan[0];

    const titleEl = document.getElementById('dash-plan-title');
    if (titleEl) titleEl.textContent = dayPlan.title;

    let html = '';
    dayPlan.activities.forEach((act, idx) => {
      const isComplete = localStorage.getItem(`workout_act_${dayPlan.day}_${idx}`) === 'done';
      html += `
        <div class="glass-card" style="padding:14px; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; border-left: 3px solid ${isComplete ? 'var(--accent-lime)' : 'var(--border-subtle)'};">
          <div style="display:flex; align-items:center; gap:12px;">
            <input type="checkbox" id="chk_dash_${dayPlan.day}_${idx}" ${isComplete ? 'checked' : ''} onchange="Dashboard.toggleActivity(${dayPlan.day}, ${idx})" style="width:20px; height:20px; accent-color:var(--accent-lime); cursor:pointer;">
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:${isComplete ? 'var(--accent-lime)' : 'var(--text-primary)'};">${act.name}</div>
              <div style="font-size:0.78rem; color:var(--text-secondary);">${act.duration} • ${act.reps} • ~${act.estCal} kcal</div>
            </div>
          </div>
          <div>
            ${act.type === 'yoga' ? `
              <button class="btn btn-outline-lime btn-sm" onclick="App.startYogaPoseByName('${act.name}')">
                🧘 Track AI
              </button>
            ` : `
              <span class="badge-difficulty diff-${act.difficulty}">${act.difficulty}</span>
            `}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function toggleActivity(day, idx) {
    const key = `workout_act_${day}_${idx}`;
    const current = localStorage.getItem(key);
    if (current === 'done') {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, 'done');
      App.showToast('Activity completed! Great consistency! 🔥');
    }
    renderTodayWorkoutActivities();
  }

  // Native Lightweight Canvas Chart for Weight Progress
  function renderWeightChart() {
    const canvas = document.getElementById('chart-weight');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth || 320;
    const h = canvas.height = 160;

    ctx.clearRect(0, 0, w, h);

    // Mock recent 7 points + current profile weight
    const profile = Auth.loadProfile() || {};
    const curW = profile.weight || 74;
    const data = [curW + 1.8, curW + 1.4, curW + 1.1, curW + 0.9, curW + 0.6, curW + 0.2, curW];
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];

    const min = Math.min(...data) - 1;
    const max = Math.max(...data) + 1;
    const range = max - min;

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const y = 20 + (i * (h - 50) / 2);
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(w - 15, y);
      ctx.stroke();
    }

    // Draw Line Graph
    const points = data.map((val, i) => {
      const x = 35 + (i * ((w - 60) / (data.length - 1)));
      const y = (h - 30) - (((val - min) / range) * (h - 60));
      return { x, y, val };
    });

    // Gradient fill under curve
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(16, 231, 89, 0.3)');
    grad.addColorStop(1, 'rgba(16, 231, 89, 0.0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, h - 25);
    ctx.lineTo(points[0].x, h - 25);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#10e759';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Dots and Labels
    points.forEach((p, idx) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#10e759';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[idx], p.x, h - 8);
    });
  }

  // Native Lightweight Canvas Bar Chart for 7-Day Consistency
  function renderConsistencyChart() {
    const canvas = document.getElementById('chart-consistency');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth || 320;
    const h = canvas.height = 140;

    ctx.clearRect(0, 0, w, h);

    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const values = [5, 4, 5, 5, 4, 5, 3]; // Exercises completed out of 5
    const barWidth = 24;
    const spacing = (w - 40) / days.length;

    days.forEach((day, i) => {
      const x = 25 + (i * spacing);
      const val = values[i];
      const maxVal = 5;
      const barHeight = (val / maxVal) * (h - 45);
      const y = (h - 25) - barHeight;

      // Bar Background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.roundRect(x, 15, barWidth, h - 40, 6);
      ctx.fill();

      // Bar Fill
      const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
      grad.addColorStop(0, '#10e759');
      grad.addColorStop(1, '#06b6d4');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 6);
      ctx.fill();

      // Label
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day, x + (barWidth / 2), h - 8);
    });
  }

  return {
    render,
    toggleActivity
  };
})();


// ========================================================
// MODULE: js/chatbot.js
// ========================================================
// public/js/chatbot.js
// SATHI AI Chatbot — Frontend Logic, Speech Input, Quick Actions & Backend Integration

const SathiChat = (() => {
  let conversationHistory = [];
  let currentMode = 'companion'; // 'companion' | 'dietitian' | 'fitness'
  let isSending = false;
  let recognition = null;

  // Initialize Speech Recognition for Voice Input
  function initSpeechRecognition(onResultCallback, onEndCallback) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (onResultCallback) onResultCallback(transcript);
      };

      recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        if (onEndCallback) onEndCallback();
      };

      recognition.onend = () => {
        if (onEndCallback) onEndCallback();
      };
    }
  }

  function startVoiceRecording(onResult, onEnd) {
    if (!recognition) {
      initSpeechRecognition(onResult, onEnd);
    }
    if (recognition) {
      try {
        recognition.start();
        return true;
      } catch (e) {
        console.warn('Recognition start exception:', e);
      }
    }
    return false;
  }

  function stopVoiceRecording() {
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
    }
  }

  // Format Markdown (Bold, Lists, Headers) into clean HTML
  function formatMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.*$)/gim, '<h4 style="margin: 6px 0; color: #f472b6; font-size: 1rem;">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 style="margin: 8px 0; color: #fdf4ff; font-size: 1.1rem;">$1</h3>')
      // Bold & Italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Bullet lists
      .replace(/^\s*•\s*(.*$)/gim, '<li>$1</li>')
      .replace(/^\s*-\s*(.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gims, '<ul style="margin: 6px 0 6px 18px;">$1</ul>')
      // Line breaks
      .replace(/\n\n/g, '<div style="margin: 8px 0;"></div>')
      .replace(/\n/g, '<br>');
    return html;
  }

  // Send message to server
  async function sendMessage(text) {
    if (!text || !text.trim() || isSending) return null;
    const userText = text.trim();
    isSending = true;

    // Append to UI immediately
    appendMessageToUI('user', userText);
    showTypingIndicator(true);

    const token = Auth.getAuthToken() || 'guest-demo-token';
    const profile = Auth.loadProfile() || {};
    const nutrientTotals = Nutrition.getDailyNutrientTotals();
    const waterTotal = Water.getTodayTotal();

    const todayStats = {
      caloriesConsumed: nutrientTotals.calories,
      proteinConsumed: nutrientTotals.protein,
      carbsConsumed: nutrientTotals.carbs,
      fatConsumed: nutrientTotals.fat,
      waterConsumed: waterTotal,
      waterTarget: Water.getDailyTarget()
    };

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-guest-mode': Auth.getCurrentUser()?.isGuest ? 'true' : 'false'
        },
        body: JSON.stringify({
          message: userText,
          history: conversationHistory,
          userProfile: profile,
          todayStats,
          chatType: currentMode
        })
      });

      showTypingIndicator(false);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      const reply = data.reply || "I'm here for you! Could you please ask that again?";

      // Append to memory history
      conversationHistory.push({ role: 'user', content: userText });
      conversationHistory.push({ role: 'model', content: reply });

      appendMessageToUI('sathi', reply);
      isSending = false;
      return reply;

    } catch (err) {
      showTypingIndicator(false);
      isSending = false;
      console.warn('Backend unavailable, using client-side smart AI engine:', err.message);

      // Intelligent on-device fallback for GitHub Pages & offline usage
      const fallbackReply = generateSmartOfflineReply(userText, currentMode, profile, todayStats);
      conversationHistory.push({ role: 'user', content: userText });
      conversationHistory.push({ role: 'model', content: fallbackReply });

      appendMessageToUI('sathi', fallbackReply);
      return fallbackReply;
    }
  }

  function appendMessageToUI(sender, content, isError = false) {
    const pane = document.getElementById('sathi-messages');
    if (!pane) return;

    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg msg-${sender}`;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (sender === 'sathi') {
      msgEl.innerHTML = `
        <div class="chat-avatar-mini">✨</div>
        <div class="msg-bubble ${isError ? 'bubble-error' : ''}">
          ${formatMarkdown(content)}
          <div class="msg-time">${timeStr} • SATHI</div>
        </div>
      `;
    } else {
      msgEl.innerHTML = `
        <div class="chat-avatar-mini">👤</div>
        <div class="msg-bubble">
          ${formatMarkdown(content)}
          <div class="msg-time">${timeStr} • You</div>
        </div>
      `;
    }

    pane.appendChild(msgEl);
    pane.scrollTop = pane.scrollHeight;
  }

  function showTypingIndicator(show) {
    const indicator = document.getElementById('sathi-typing');
    if (indicator) {
      indicator.style.display = show ? 'flex' : 'none';
      if (show) {
        const pane = document.getElementById('sathi-messages');
        if (pane) pane.scrollTop = pane.scrollHeight;
      }
    }
  }

  function setMode(mode) {
    if (['companion', 'dietitian', 'fitness'].includes(mode)) {
      currentMode = mode;
      return currentMode;
    }
    return currentMode;
  }

  function resetChat() {
    conversationHistory = [];
    const pane = document.getElementById('sathi-messages');
    if (pane) {
      pane.innerHTML = '';
      appendWelcomeMessage();
    }
  }

  function appendWelcomeMessage() {
    const profile = Auth.loadProfile() || {};
    const name = profile.name ? profile.name.split(' ')[0] : 'there';
    const welcome = `Hey ${name}! I'm **SATHI** ✨\n\nYour personal AI fitness, yoga, and wellness companion.\n\n` +
      `Here's what you can ask me:\n` +
      `• 🧘 *"How do I align my hips in Warrior II?"*\n` +
      `• 🔥 *"My maintenance is 2,400 calories. What is a 350-calorie deficit?"*\n` +
      `• 🥗 *"Can I replace paneer with tofu in lunch?"*\n` +
      `• 🍲 *"How many calories are in 2 rotis and a bowl of dal?"*\n` +
      `• 💧 *"How much water should I drink today?"*\n\n` +
      `Tap a quick action card below or type any question!`;

    appendMessageToUI('sathi', welcome);
  }

  function generateSmartOfflineReply(text, mode, profile, todayStats) {
    const q = (text || '').toLowerCase();
    const weight = profile?.weight || 70;
    const height = profile?.height || 175;
    const age = profile?.age || 26;
    const sex = profile?.sex || 'male';

    // 1. Calorie & BMR / Deficit Questions
    if (q.includes('bmr') || q.includes('maintenance') || q.includes('deficit') || q.includes('tdee') || q.includes('calorie')) {
      const bmr = typeof Calories !== 'undefined' ? Calories.calculateBMR(weight, height, age, sex) : 1650;
      const tdee = typeof Calories !== 'undefined' ? Calories.calculateTDEE(bmr, profile?.activity_level || 'moderate') : 2400;
      const targets = typeof Calories !== 'undefined' ? Calories.calculateTargets(tdee, 'fat_loss', sex, age) : { targetCalories: 1950, description: 'Moderate fat loss deficit' };

      if (q.includes('deficit')) {
        return `🔥 **Calorie Deficit Breakdown:**\n\n` +
          `• **Estimated TDEE (Maintenance):** ${tdee} kcal/day\n` +
          `• **Recommended Sustainable Deficit:** -400 to -500 kcal/day\n` +
          `• **Your Fat Loss Target:** ~${targets.targetCalories} kcal/day\n\n` +
          `💡 *Tip: Never drop below 1,200 kcal (female) or 1,500 kcal (male) to preserve lean muscle and thyroid metabolism.*`;
      }
      return `🔥 **Your Metabolic Profile:**\n\n` +
        `• **BMR (Basal Rate):** ${bmr} kcal/day\n` +
        `• **TDEE (Daily Energy):** ${tdee} kcal/day\n` +
        `• **Goal Target:** ${targets.targetCalories} kcal/day (${targets.description})\n\n` +
        `Ask me for Indian food swap ideas or macro percentages!`;
    }

    // 2. Indian Food / Nutrition Swaps
    if (q.includes('paneer') || q.includes('tofu') || q.includes('roti') || q.includes('rice') || q.includes('dal') || q.includes('swap') || q.includes('food') || q.includes('diet') || mode === 'dietitian') {
      if (q.includes('paneer') && q.includes('tofu')) {
        return `🥗 **Paneer vs. Tofu Swap:**\n\n` +
          `• **100g Regular Paneer:** 265 kcal | 18g Protein | 20g Fat\n` +
          `• **100g Firm Tofu:** 95 kcal | 12g Protein | 4.5g Fat\n\n` +
          `✨ **Recommendation:** If you are in a caloric deficit, firm tofu saves ~170 kcal with 75% less fat while maintaining great protein! You can also opt for **low-fat paneer** (170 kcal, 19g protein, 9g fat).`;
      }
      if (q.includes('roti') || q.includes('rice') || q.includes('dal')) {
        return `🍲 **Indian Meal Nutrition Breakdown:**\n\n` +
          `• **1 Medium Wheat Roti (Phulka):** ~85 kcal | 2.8g P | 17g C | 0.8g F\n` +
          `• **1 Katori Cooked White Rice (150g):** ~195 kcal | 4.0g P | 43g C | 0.5g F\n` +
          `• **1 Bowl Yellow Moong Dal (150g):** ~135 kcal | 8.5g P | 20g C | 2.5g F\n\n` +
          `✨ **Balanced Plate Formula:** 2 Rotis (170 kcal) + 1.5 bowls Dal (200 kcal) + 1 bowl Sabzi (95 kcal) + Cucumber salad (35 kcal) = **~500 kcal high-fiber meal**!`;
      }
      return `🥗 **Dietitian Insights:**\n\n` +
        `Focus on prioritizing protein (aim for ~${Math.round(weight * 1.8)}g daily) from moong dal, soya chunks, roasted chana, paneer/tofu, and eggs.\n\n` +
        `What specific food or meal would you like to calculate or swap?`;
    }

    // 3. Yoga Pose Alignments
    if (q.includes('warrior') || q.includes('tree') || q.includes('dog') || q.includes('cobra') || q.includes('tadasana') || q.includes('pose') || q.includes('yoga') || mode === 'companion') {
      if (q.includes('warrior')) {
        return `🧘 **Warrior II (Virabhadrasana II) Alignment Checklist:**\n\n` +
          `1. **Front Knee:** Bend directly over ankle at 90°, tracking over the second toe.\n` +
          `2. **Back Leg:** Keep straight with back foot angled 45° inward, outer heel pressed down.\n` +
          `3. **Pelvis & Torso:** Open hips wide towards the side; keep spine vertically erect.\n` +
          `4. **Arms & Gaze:** Extend arms parallel to ground at shoulder height, gaze over front fingertips.\n\n` +
          `*Try launching a live session in the **Yoga** tab with your camera to get real-time angle feedback!*`;
      }
      if (q.includes('tree')) {
        return `🧘 **Tree Pose (Vrikshasana) Alignment Tips:**\n\n` +
          `1. Root all four corners of standing foot into the mat.\n` +
          `2. Place lifted foot against **inner calf** or **upper inner thigh** — **NEVER directly on the knee joint**.\n` +
          `3. Fix eyes (*Drishti*) onto a stationary point 5 feet ahead.\n` +
          `4. Bring palms together at chest center in Anjali Mudra.`;
      }
    }

    // 4. Water / Hydration
    if (q.includes('water') || q.includes('hydration') || q.includes('drink')) {
      const target = typeof Water !== 'undefined' ? Water.getDailyTarget() : 2800;
      const current = typeof Water !== 'undefined' ? Water.getTodayTotal() : 1250;
      const pct = Math.min(100, Math.round((current / target) * 100));
      return `💧 **Hydration Status:**\n\n` +
        `• **Your Target:** ${target} ml (~${(target / 1000).toFixed(1)} L)\n` +
        `• **Drank Today:** ${current} ml (${pct}% complete)\n\n` +
        `*Scientific guideline: 35ml per kg body weight helps support metabolic burn and cognitive focus!*`;
    }

    // 5. Workout / Fitness Plans
    if (q.includes('workout') || q.includes('exercise') || q.includes('pushup') || q.includes('squat') || mode === 'fitness') {
      return `💪 **FitAI Fitness Coach Tip:**\n\n` +
        `Your personalized 7-day program is designed with exactly **5 activities per day** combining strength, mobility, and progressive overload.\n\n` +
        `• **Consistency:** 30–45 mins daily creates lasting habit pathways.\n` +
        `• **Rest:** Day 4 & Day 7 include active recovery yoga to downregulate cortisol.\n\n` +
        `Head over to the **Workouts** tab to view today's session details!`;
    }

    // Fallback Conversational Response
    return `✨ **SATHI AI:** I'm tuned to assist your journey! You can ask me:\n\n` +
      `• *"What is my maintenance and fat loss deficit?"*\n` +
      `• *"How much protein should I eat daily?"*\n` +
      `• *"Can I swap paneer with tofu in lunch?"*\n` +
      `• *"How do I align my hips in Warrior II?"*\n` +
      `• *"How much water should I drink today?"*`;
  }

  return {
    sendMessage,
    setMode,
    resetChat,
    appendWelcomeMessage,
    startVoiceRecording,
    stopVoiceRecording
  };
})();


// ========================================================
// MODULE: js/app.js
// ========================================================
// public/js/app.js
// Main Application Controller, Router, Event Handlers & Lifecycle

const App = (() => {
  let activeScreen = 'welcome';
  let deferredPrompt = null;

  // Screen List
  const SCREENS = [
    'welcome', 'auth', 'onboarding', 'dashboard',
    'yoga', 'workouts', 'nutrition', 'water',
    'sathi', 'progress', 'profile'
  ];

  // Protected Screens that require authentication
  const PROTECTED_SCREENS = [
    'dashboard', 'yoga', 'workouts', 'nutrition',
    'water', 'sathi', 'progress', 'profile'
  ];

  // 1. App Initialization
  function init() {
    registerServiceWorker();
    setupEventListeners();
    setupPWAInstall();

    // Check initial route
    const hash = window.location.hash.replace('#', '') || 'welcome';
    navigateTo(hash);
  }

  // 2. Navigation & Router
  function navigateTo(screenName) {
    if (!SCREENS.includes(screenName)) {
      screenName = 'welcome';
    }

    // Auth Guard
    if (PROTECTED_SCREENS.includes(screenName) && !Auth.isAuthenticated()) {
      showToast('Please log in or try Guest Demo mode to access fitness features.', 'warning');
      screenName = 'auth';
    }

    // Check if onboarding is needed
    if (Auth.isAuthenticated() && screenName === 'dashboard') {
      const profile = Auth.loadProfile();
      if (!profile || !profile.onboardingComplete) {
        screenName = 'onboarding';
      }
    }

    activeScreen = screenName;
    window.location.hash = `#${screenName}`;

    // Hide all screens, show active
    document.querySelectorAll('.app-screen').forEach(el => {
      el.classList.remove('active');
    });

    const targetEl = document.getElementById(`screen-${screenName}`);
    if (targetEl) targetEl.classList.add('active');

    // Update Bottom Nav
    updateNavState(screenName);

    // Screen specific triggers
    onScreenEnter(screenName);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateNavState(screenName) {
    const bottomNav = document.getElementById('bottom-nav');
    if (!bottomNav) return;

    if (['welcome', 'auth', 'onboarding'].includes(screenName)) {
      bottomNav.style.display = 'none';
    } else {
      bottomNav.style.display = 'flex';
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.screen === screenName) {
        item.classList.add('active');
      }
    });
  }

  function onScreenEnter(screenName) {
    switch (screenName) {
      case 'dashboard':
        Dashboard.render();
        break;
      case 'yoga':
        renderYogaPoseLibrary();
        break;
      case 'workouts':
        renderWorkoutPlans();
        renderFitnessExercisesList();
        break;
      case 'nutrition':
        renderNutritionScreen();
        break;
      case 'water':
        renderWaterScreen();
        break;
      case 'sathi':
        const pane = document.getElementById('sathi-messages');
        if (pane && pane.children.length === 0) {
          SathiChat.appendWelcomeMessage();
        }
        break;
      case 'profile':
        renderProfileScreen();
        break;
    }
  }

  // 3. Setup Global UI Event Listeners
  function setupEventListeners() {
    // Hash change handler
    window.addEventListener('hashchange', () => {
      const screen = window.location.hash.replace('#', '');
      if (screen && screen !== activeScreen) {
        navigateTo(screen);
      }
    });

    // Bottom Navigation click
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const screen = item.dataset.screen;
        if (screen) navigateTo(screen);
      });
    });

    // Quick Action chips in SATHI
    document.querySelectorAll('.sathi-action-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.dataset.query;
        if (query) {
          const input = document.getElementById('sathi-input-field');
          if (input) input.value = query;
          sendSathiMessage();
        }
      });
    });

    // Enter key in SATHI input
    const sathiInput = document.getElementById('sathi-input-field');
    if (sathiInput) {
      sathiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendSathiMessage();
        }
      });
    }

    // Modal Close buttons
    document.querySelectorAll('.modal-close, .btn-modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        closeAllModals();
      });
    });
  }

  // 4. SATHI Chat Actions
  function sendSathiMessage() {
    const input = document.getElementById('sathi-input-field');
    if (!input || !input.value.trim()) return;
    const text = input.value.trim();
    input.value = '';
    SathiChat.sendMessage(text);
  }

  function askSathiFromAnywhere(query) {
    navigateTo('sathi');
    setTimeout(() => {
      SathiChat.sendMessage(query);
    }, 200);
  }

  // 5. Yoga Tracker Controls
  async function startLiveYogaSession(poseId) {
    const videoEl = document.getElementById('yoga-video-feed');
    const canvasEl = document.getElementById('yoga-canvas-feed');
    const statusBanner = document.getElementById('yoga-status-banner');
    const feedbackText = document.getElementById('yoga-feedback-text');
    const hudBadge = document.getElementById('yoga-hud-status');
    const timerEl = document.getElementById('yoga-hold-timer');

    if (!videoEl || !canvasEl) return;

    document.getElementById('yoga-camera-view').style.display = 'block';
    document.getElementById('yoga-library-view').style.display = 'none';

    const result = await PoseTracker.startSession(poseId, videoEl, canvasEl, (status) => {
      if (statusBanner) {
        statusBanner.className = `camera-feedback-banner ${status.status === 'correct' ? 'correct' : ''}`;
      }
      if (feedbackText) feedbackText.textContent = status.message;
      if (hudBadge) {
        hudBadge.className = `hud-badge status-${status.status === 'correct' ? 'correct' : status.status === 'needs_adjustment' ? 'adjust' : 'unknown'}`;
        hudBadge.textContent = status.status === 'correct' ? '✓ Correct Alignment' : status.status === 'needs_adjustment' ? '⚡ Adjust Form' : '⚠ Step Into Frame';
      }
      if (timerEl) {
        timerEl.textContent = status.holdSeconds ? `${status.holdSeconds}s Held` : '0s Held';
      }
    });

    if (!result.success) {
      showToast(result.error, 'error');
    }
  }

  function stopLiveYogaSession() {
    const summary = PoseTracker.stopSession();
    document.getElementById('yoga-camera-view').style.display = 'none';
    document.getElementById('yoga-library-view').style.display = 'block';

    // Show Session Summary Modal
    const summaryModal = document.getElementById('modal-session-summary');
    if (summaryModal) {
      document.getElementById('summary-pose-name').textContent = summary.poseName;
      document.getElementById('summary-duration').textContent = `${Math.floor(summary.durationSeconds / 60)}m ${summary.durationSeconds % 60}s`;
      document.getElementById('summary-calories').textContent = `${summary.caloriesBurned} kcal`;
      document.getElementById('summary-accuracy').textContent = `${summary.accuracyScore}%`;
      summaryModal.classList.add('open');
    }
  }

  function startYogaPoseByName(poseName) {
    const pose = Workouts.YOGA_POSES.find(p => p.name === poseName || p.english === poseName || p.sanskrit === poseName) || Workouts.YOGA_POSES[0];
    navigateTo('yoga');
    setTimeout(() => {
      startLiveYogaSession(pose.id);
    }, 250);
  }

  // 6. Yoga Pose Library View
  function renderYogaPoseLibrary(filterCat = 'all', searchQuery = '') {
    const container = document.getElementById('yoga-poses-grid');
    if (!container) return;

    let poses = Workouts.YOGA_POSES;
    if (filterCat !== 'all') {
      poses = poses.filter(p => p.category === filterCat);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      poses = poses.filter(p => p.english.toLowerCase().includes(q) || p.sanskrit.toLowerCase().includes(q));
    }

    let html = '';
    poses.forEach(p => {
      html += `
        <div class="pose-card" onclick="App.startLiveYogaSession('${p.id}')">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <span class="badge-difficulty diff-${p.difficulty}">${p.difficulty}</span>
              <span style="font-size:0.75rem; color:var(--accent-teal); text-transform:capitalize;">${p.category}</span>
            </div>
            <h4 style="font-size:1.05rem; margin-bottom:2px;">${p.english}</h4>
            <div style="font-size:0.82rem; color:var(--accent-lime); font-style:italic; margin-bottom:8px;">${p.sanskrit}</div>
            <p style="font-size:0.8rem; color:var(--text-secondary); line-height:1.4; margin-bottom:12px;">${p.target}</p>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:10px;">
            <span style="font-size:0.75rem; color:var(--text-muted);">Live AI Cam</span>
            <button class="btn btn-primary btn-sm" style="padding:4px 10px; font-size:0.75rem;">Start Pose</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // 7. Workouts & 7-Day Plans View
  function renderWorkoutPlans(selectedDay = 1) {
    const container = document.getElementById('workout-plan-container');
    if (!container) return;

    const weekly = Workouts.generateWeeklyPlan();
    const plan = weekly[selectedDay - 1] || weekly[0];

    let html = `
      <div class="glass-card highlight" style="margin-bottom:18px;">
        <h3 style="font-size:1.2rem; color:var(--accent-lime); margin-bottom:4px;">${plan.title}</h3>
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;">Focus: ${plan.focus}</p>
        <div style="background:rgba(0,0,0,0.3); padding:10px 14px; border-radius:var(--radius-md); font-size:0.8rem; margin-bottom:8px;">
          <strong>🔥 Warm-Up:</strong> ${plan.warmup}
        </div>
        <div style="background:rgba(0,0,0,0.3); padding:10px 14px; border-radius:var(--radius-md); font-size:0.8rem;">
          <strong>❄️ Cooldown:</strong> ${plan.cooldown}
        </div>
      </div>
      <h4 style="margin-bottom:12px; font-size:1rem;">5 Planned Daily Activities</h4>
    `;

    plan.activities.forEach((act, idx) => {
      const isDone = localStorage.getItem(`workout_act_${plan.day}_${idx}`) === 'done';
      html += `
        <div class="glass-card" style="margin-bottom:12px; border-left: 3px solid ${isDone ? 'var(--accent-lime)' : 'var(--border-subtle)'};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
            <div>
              <div style="font-size:0.75rem; color:var(--accent-teal); text-transform:uppercase; font-weight:700;">Activity ${idx + 1} • ${act.type}</div>
              <h4 style="font-size:1.05rem; color:${isDone ? 'var(--accent-lime)' : 'var(--text-primary)'};">${act.name}</h4>
            </div>
            <input type="checkbox" ${isDone ? 'checked' : ''} onchange="Dashboard.toggleActivity(${plan.day}, ${idx})" style="width:20px; height:20px; accent-color:var(--accent-lime); cursor:pointer;">
          </div>
          <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:10px;">${act.instructions}</p>
          <div style="display:flex; flex-wrap:wrap; gap:12px; font-size:0.78rem; color:var(--text-muted); align-items:center;">
            <span>⏱ ${act.duration}</span>
            <span>🔄 ${act.reps}</span>
            <span>🔥 ~${act.estCal} kcal</span>
            <span>🎯 ${act.muscles}</span>
            ${act.sub ? `<span style="color:var(--accent-warning);">⚡ Alt: ${act.sub}</span>` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderFitnessExercisesList() {
    const container = document.getElementById('fitness-exercises-grid');
    if (!container) return;

    let html = '';
    Workouts.FITNESS_EXERCISES.forEach(ex => {
      html += `
        <div class="glass-card" style="padding:16px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <h4 style="font-size:1rem;">${ex.name}</h4>
            <span class="badge-difficulty diff-${ex.difficulty}">${ex.difficulty}</span>
          </div>
          <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:10px;">${ex.instructions}</p>
          <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--text-muted); border-top:1px solid var(--border-subtle); padding-top:8px;">
            <span>🎯 ${ex.target}</span>
            <span>${ex.sets} Sets • ${ex.defaultReps ? ex.defaultReps + ' Reps' : ex.defaultDuration + 's'}</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // 8. Nutrition Screen (Calculator, Meal Plan & Food Logger)
  function renderNutritionScreen() {
    renderCalorieCalculatorInputs();
    renderMealPlan();
    renderFoodLogger();
  }

  function renderCalorieCalculatorInputs() {
    const profile = Auth.loadProfile() || { age: 26, weight: 70, height: 175, sex: 'male', activity_level: 'moderate', fitness_goal: 'fat_loss' };
    const ageEl = document.getElementById('calc-age');
    const weightEl = document.getElementById('calc-weight');
    const heightEl = document.getElementById('calc-height');
    const sexEl = document.getElementById('calc-sex');
    const actEl = document.getElementById('calc-activity');
    const goalEl = document.getElementById('calc-goal');

    if (ageEl) ageEl.value = profile.age || 26;
    if (weightEl) weightEl.value = profile.weight || 70;
    if (heightEl) heightEl.value = profile.height || 175;
    if (sexEl) sexEl.value = profile.sex || 'male';
    if (actEl) actEl.value = profile.activity_level || 'moderate';
    if (goalEl) goalEl.value = profile.fitness_goal || 'fat_loss';

    calculateAndDisplayNutrition();
  }

  function calculateAndDisplayNutrition() {
    const age = parseInt(document.getElementById('calc-age')?.value) || 26;
    const weight = parseFloat(document.getElementById('calc-weight')?.value) || 70;
    const height = parseFloat(document.getElementById('calc-height')?.value) || 175;
    const sex = document.getElementById('calc-sex')?.value || 'male';
    const activity = document.getElementById('calc-activity')?.value || 'moderate';
    const goal = document.getElementById('calc-goal')?.value || 'fat_loss';

    const bmr = Calories.calculateBMR(weight, height, age, sex);
    const tdee = Calories.calculateTDEE(bmr, activity);
    const targets = Calories.calculateTargets(tdee, goal, sex, age);
    const macros = Calories.calculateMacros(targets.targetCalories, weight, goal);

    document.getElementById('res-bmr').textContent = `${bmr} kcal`;
    document.getElementById('res-tdee').textContent = `${tdee} kcal`;
    document.getElementById('res-target').textContent = `${targets.targetCalories} kcal`;
    document.getElementById('res-goal-desc').textContent = targets.description;

    document.getElementById('res-protein').textContent = `${macros.protein.grams}g (${macros.protein.percent}%)`;
    document.getElementById('res-carbs').textContent = `${macros.carbs.grams}g (${macros.carbs.percent}%)`;
    document.getElementById('res-fat').textContent = `${macros.fat.grams}g (${macros.fat.percent}%)`;

    // Save updated calculations
    const profile = Auth.loadProfile() || {};
    profile.age = age;
    profile.weight = weight;
    profile.height = height;
    profile.sex = sex;
    profile.activity_level = activity;
    profile.fitness_goal = goal;
    Auth.saveProfile(profile);
  }

  function renderMealPlan(dietType = 'vegetarian') {
    const container = document.getElementById('meal-plan-cards');
    if (!container) return;

    const profile = Auth.loadProfile() || { fitness_goal: 'fat_loss' };
    const targetCal = parseInt(document.getElementById('res-target')?.textContent) || 2000;
    const plan = Nutrition.generateMealPlan(targetCal, dietType, profile.fitness_goal || 'fat_loss');

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h4 style="font-size:1.1rem; color:var(--accent-lime);">${plan.title}</h4>
        <span style="font-size:0.85rem; font-weight:700;">Daily Total: ~${plan.dailyTotal.calories} kcal • ${plan.dailyTotal.protein}g Protein</span>
      </div>
    `;

    plan.meals.forEach(m => {
      html += `
        <div class="glass-card" style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid var(--border-subtle); padding-bottom:6px;">
            <strong style="color:var(--text-primary); font-size:0.95rem;">${m.name}</strong>
            <span style="font-size:0.82rem; color:var(--accent-lime); font-weight:700;">~${m.mealCal} kcal | ${m.mealProtein}g P</span>
          </div>
          <ul style="list-style:none; padding:0; margin-bottom:8px;">
            ${m.items.map(i => `
              <li style="display:flex; justify-content:space-between; font-size:0.85rem; padding:3px 0;">
                <span>${i.item} <span style="color:var(--text-muted);">(${i.portion})</span></span>
                <span style="color:var(--text-secondary);">${i.cal} kcal</span>
              </li>
            `).join('')}
          </ul>
          <div style="font-size:0.75rem; color:var(--text-muted); background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:var(--radius-sm);">
            💡 <strong>Alt:</strong> ${m.substitutions}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderFoodLogger() {
    const select = document.getElementById('food-select-db');
    if (select && select.options.length <= 1) {
      select.innerHTML = '<option value="">-- Choose from 30+ items --</option>' +
        Nutrition.FOOD_DATABASE.map(f => `<option value="${f.id}">${f.name} (${f.serving} - ${f.calories} kcal)</option>`).join('');
    }

    const container = document.getElementById('food-log-today-list');
    if (!container) return;

    const logs = Nutrition.getDailyFoodLogs();
    if (logs.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">No meals logged yet today. Search or select a food above!</div>`;
      return;
    }

    let html = '';
    logs.forEach(item => {
      html += `
        <div class="glass-card" style="padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:700; font-size:0.9rem;">${item.name}</div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">${item.serving} • ${item.calories} kcal (P: ${item.protein}g, C: ${item.carbs}g, F: ${item.fat}g)</div>
          </div>
          <button class="btn btn-sm" onclick="App.deleteFoodLog('${item.id}')" style="background:rgba(239, 68, 68, 0.2); color:#f87171; padding:4px 8px;">✕</button>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function addFoodLogFromSelection() {
    const select = document.getElementById('food-select-db');
    const multiplierEl = document.getElementById('food-quantity-input');
    const mealTypeEl = document.getElementById('food-mealtype-input');

    const foodId = select?.value;
    const mult = parseFloat(multiplierEl?.value) || 1;
    const mealType = mealTypeEl?.value || 'lunch';

    if (!foodId) {
      showToast('Please select a food from the database.', 'warning');
      return;
    }

    const food = Nutrition.FOOD_DATABASE.find(f => f.id === foodId);
    if (food) {
      Nutrition.addFoodLog(food, mult, mealType);
      renderFoodLogger();
      showToast(`Logged ${food.name}!`);
    }
  }

  function deleteFoodLog(id) {
    Nutrition.removeFoodLog(id);
    renderFoodLogger();
    showToast('Removed entry.');
  }

  // 9. Water Tracker Screen
  function renderWaterScreen() {
    const target = Water.getDailyTarget();
    const consumed = Water.getTodayTotal();
    const percent = Math.min(100, Math.round((consumed / target) * 100));
    const remaining = Math.max(0, target - consumed);

    const amountEl = document.getElementById('water-screen-amount');
    const targetEl = document.getElementById('water-screen-target');
    const remainEl = document.getElementById('water-screen-remain');
    const circleEl = document.getElementById('water-svg-circle');

    if (amountEl) amountEl.textContent = `${consumed} ml`;
    if (targetEl) targetEl.textContent = `${target} ml`;
    if (remainEl) remainEl.textContent = `${remaining} ml`;

    if (circleEl) {
      const circumference = 2 * Math.PI * 70; // radius = 70
      const offset = circumference - (percent / 100) * circumference;
      circleEl.style.strokeDashoffset = offset;
    }

    // Render Water Logs
    const listEl = document.getElementById('water-logs-list');
    if (listEl) {
      const logs = Water.getTodayLogs();
      if (logs.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:0.85rem;">No water entries logged yet today.</div>`;
      } else {
        listEl.innerHTML = logs.map(l => `
          <div class="glass-card" style="padding:10px 14px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="font-size:0.9rem;">+${l.amount} ml</strong>
              <span style="font-size:0.75rem; color:var(--text-secondary); margin-left:8px;">${l.time}</span>
            </div>
            <button class="btn btn-sm" onclick="App.deleteWaterLog('${l.id}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">✕</button>
          </div>
        `).join('');
      }
    }
  }

  function addWaterQuick(amount) {
    Water.addWater(amount);
    renderWaterScreen();
    showToast(`Added ${amount} ml of water! 💧`);
  }

  function addWaterCustom() {
    const input = document.getElementById('water-custom-input');
    const val = parseInt(input?.value);
    if (val && val > 0) {
      Water.addWater(val);
      if (input) input.value = '';
      renderWaterScreen();
      showToast(`Added ${val} ml! 💧`);
    }
  }

  function deleteWaterLog(id) {
    Water.removeLog(id);
    renderWaterScreen();
  }

  // 10. Profile & Settings Screen
  function renderProfileScreen() {
    const profile = Auth.loadProfile() || {};
    const user = Auth.getCurrentUser() || {};

    const nameEl = document.getElementById('prof-name');
    const emailEl = document.getElementById('prof-email');
    const goalEl = document.getElementById('prof-goal');
    const weightEl = document.getElementById('prof-weight');

    if (nameEl) nameEl.textContent = profile.name || user.name || 'Athlete';
    if (emailEl) emailEl.textContent = user.email || 'athlete@fitai.local';
    if (goalEl) goalEl.textContent = (profile.fitness_goal || 'fat_loss').replace('_', ' ').toUpperCase();
    if (weightEl) weightEl.textContent = `${profile.weight || 70} kg`;
  }

  // 11. Modal & Notification System
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'warning' ? 'toast-warning' : ''}`;
    toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✨'}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // 12. PWA Registration
  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('✅ FitAI ServiceWorker registered.'))
        .catch(err => console.warn('ServiceWorker registration error:', err));
    }
  }

  function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const btn = document.getElementById('btn-pwa-install');
      if (btn) btn.style.display = 'inline-flex';
    });
  }

  function triggerPWAInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        deferredPrompt = null;
        const btn = document.getElementById('btn-pwa-install');
        if (btn) btn.style.display = 'none';
      });
    } else {
      showToast('FitAI Coach is already installed or ready in browser menu!', 'success');
    }
  }

  return {
    init,
    navigateTo,
    sendSathiMessage,
    askSathiFromAnywhere,
    startLiveYogaSession,
    stopLiveYogaSession,
    startYogaPoseByName,
    renderYogaPoseLibrary,
    renderWorkoutPlans,
    calculateAndDisplayNutrition,
    renderMealPlan,
    addFoodLogFromSelection,
    deleteFoodLog,
    addWaterQuick,
    addWaterCustom,
    deleteWaterLog,
    showToast,
    closeAllModals,
    triggerPWAInstall
  };
})();

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});



  // Immediate bootstrap if DOM is already ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (typeof App !== 'undefined' && typeof App.init === 'function') {
      try { App.init(); } catch (e) { console.warn(e); }
    }
  }
}
