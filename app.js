const SODIUM_TARGET = 2000;
const WATER_TARGET_OZ = 96;
const SLEEP_TARGET = 8;
const STORAGE_PREFIX = "bp-day:";

function todayKey(d = new Date()) {
  return d.toISOString().split("T")[0];
}
function dayLabel(key) {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" });
}
function getWeekStart(offset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - dow + offset * 7);
  return d;
}
function weekDates(offset = 0) {
  const start = getWeekStart(offset);
  const arr = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    arr.push(todayKey(d));
  }
  return arr;
}
function formatShort(key) {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function weekRangeLabel(offset) {
  const dates = weekDates(offset);
  const label = `${formatShort(dates[0])} – ${formatShort(dates[6])}`;
  if (offset === 0) return `This week · ${label}`;
  if (offset === -1) return `Last week · ${label}`;
  return label;
}
function weekSummary(offset) {
  const dates = weekDates(offset);
  let sodiumDays = 0, waterDays = 0, sleepDays = 0, workouts = 0, readings = 0, count = 0;
  dates.forEach((k) => {
    const d = loadDay(k);
    if (d.sodium || d.water || d.sleep || d.workout || d.sys || d.notes) count++;
    if (d.sodium && d.sodium <= SODIUM_TARGET) sodiumDays++;
    if (d.water >= WATER_TARGET_OZ) waterDays++;
    if (d.sleep >= SLEEP_TARGET) sleepDays++;
    if (d.workout) workouts++;
    if (d.sys && d.dia) readings++;
  });
  return { sodiumDays, waterDays, sleepDays, workouts, readings, loggedDays: count };
}
function emptyDay() {
  return { sodium: 0, water: 0, sleep: 0, workout: false, sys: "", dia: "", notes: "", meals: { breakfast: "", lunch: "", snack: "", dinner: "" } };
}
function loadDay(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? { ...emptyDay(), ...JSON.parse(raw) } : emptyDay();
  } catch {
    return emptyDay();
  }
}
function saveDay(key, data) {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
}
function classify(sys, dia) {
  if (!sys || !dia) return null;
  sys = Number(sys); dia = Number(dia);
  if (sys < 120 && dia < 80) return { label: "Normal", color: "#6FA98A" };
  if (sys < 130 && dia < 80) return { label: "Elevated", color: "#E8A33D" };
  if (sys < 140 || dia < 90) return { label: "Stage 1", color: "#E08A4B" };
  return { label: "Stage 2", color: "#D9695F" };
}
function score(d) {
  if (!d) return 0.5;
  let s = 0, n = 0;
  if (d.sodium) { s += Math.max(0, 1 - d.sodium / SODIUM_TARGET); n++; }
  if (d.water) { s += Math.min(1, d.water / WATER_TARGET_OZ); n++; }
  if (d.sleep) { s += Math.min(1, d.sleep / SLEEP_TARGET); n++; }
  if (d.workout) { s += 1; n++; }
  return n ? s / n : 0.5;
}

const MEAL_IDEAS = {
  breakfast: [
    "Oats with walnuts, blueberries, ground flaxseed",
    "Greek yogurt with sliced banana and chia seeds",
    "Veggie omelet with spinach + whole wheat toast",
    "Smoothie: spinach, berries, flaxseed, unsweetened almond milk",
  ],
  lunch: [
    "Grilled salmon over spinach & quinoa salad, olive oil-lemon dressing",
    "Grilled chicken, brown rice, roasted broccoli",
    "Lentil soup with a side salad",
    "Turkey & avocado wrap on whole wheat, side of carrots",
  ],
  snack: [
    "Apple + handful of almonds",
    "Carrot sticks with hummus",
    "Handful of walnuts or pumpkin seeds",
    "Low-fat Greek yogurt with berries",
  ],
  dinner: [
    "Stir-fried veggies with tofu, brown rice",
    "Baked cod, sweet potato, steamed green beans",
    "Grilled lean beef, quinoa, roasted peppers",
    "Chickpea & vegetable curry over brown rice",
  ],
};
function ideaFor(mealType, dateKey) {
  const d = new Date(dateKey + "T00:00:00");
  const idx = d.getDay() % MEAL_IDEAS[mealType].length;
  return MEAL_IDEAS[mealType][idx];
}
function youtubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " recipe")}`;
}

let weekOffset = 0;
let activeDay = todayKey();

function render() {
  const week = weekDates(weekOffset);
  const today = loadDay(activeDay);

  // Week range label + summary
  const summary = weekSummary(weekOffset);
  document.getElementById("week-range").textContent =
    `${weekRangeLabel(weekOffset)} · ${summary.workouts}/7 workouts · ${summary.readings} readings logged`;
  document.getElementById("week-next").disabled = weekOffset >= 0;
  document.getElementById("week-next").style.opacity = weekOffset >= 0 ? 0.4 : 1;

  // Day selector
  const sel = document.getElementById("day-selector");
  sel.innerHTML = "";
  week.forEach((k) => {
    const btn = document.createElement("button");
    btn.className = "day-btn" + (k === activeDay ? " active" : "") + (k === todayKey() ? " today" : "");
    btn.textContent = dayLabel(k) + (loadDay(k).sys ? " •" : "");
    btn.onclick = () => { activeDay = k; render(); };
    sel.appendChild(btn);
  });

  // Trace
  const points = week.map((k, i) => {
    const sc = score(loadDay(k));
    const x = (i / 6) * 320;
    const y = 40 - sc * 32;
    return `${x},${y}`;
  }).join(" ");
  document.getElementById("trace-line").setAttribute("points", points);

  // BP inputs
  document.getElementById("sys").value = today.sys;
  document.getElementById("dia").value = today.dia;
  const status = classify(today.sys, today.dia);
  const badge = document.getElementById("status-badge");
  if (status) {
    badge.style.display = "inline-block";
    badge.textContent = status.label;
    badge.style.background = status.color + "22";
    badge.style.color = status.color;
  } else {
    badge.style.display = "none";
  }

  // Sodium
  document.getElementById("sodium-value").textContent = `${today.sodium}/${SODIUM_TARGET} mg`;
  const sodiumPct = Math.min(100, (today.sodium / SODIUM_TARGET) * 100);
  const sodiumOver = today.sodium > SODIUM_TARGET;
  const sodiumBar = document.getElementById("sodium-bar");
  sodiumBar.style.width = sodiumPct + "%";
  sodiumBar.style.background = sodiumOver ? "#D9695F" : "#E8A33D";
  document.getElementById("sodium-value").style.color = sodiumOver ? "#D9695F" : "#8FA4BC";

  // Water
  document.getElementById("water-value").textContent = `${today.water}/${WATER_TARGET_OZ} oz`;
  document.getElementById("water-bar").style.width = Math.min(100, (today.water / WATER_TARGET_OZ) * 100) + "%";
  const waterBtns = document.getElementById("water-buttons");
  waterBtns.innerHTML = "";
  [8, 16, 24].forEach((amt) => {
    const b = document.createElement("button");
    b.className = "quick-btn";
    b.style.color = "#5FA8D3";
    b.textContent = `+${amt}oz`;
    b.onclick = () => { const d = loadDay(activeDay); d.water += amt; saveDay(activeDay, d); render(); };
    waterBtns.appendChild(b);
  });
  if (today.water > 0) {
    const clear = document.createElement("button");
    clear.className = "icon-btn clear-btn";
    clear.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8FA4BC" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>`;
    clear.onclick = () => { const d = loadDay(activeDay); d.water = 0; saveDay(activeDay, d); render(); };
    waterBtns.appendChild(clear);
  }

  // Sleep
  document.getElementById("sleep-value").textContent = `${today.sleep}/${SLEEP_TARGET} hrs`;
  document.getElementById("sleep-bar").style.width = Math.min(100, (today.sleep / SLEEP_TARGET) * 100) + "%";
  document.getElementById("sleep-slider").value = today.sleep;

  // Workout
  const knob = document.getElementById("workout-knob");
  const toggle = document.getElementById("workout-toggle");
  toggle.style.background = today.workout ? "#6FA98A" : "#24405f";
  knob.style.left = today.workout ? "26px" : "4px";

  // Notes
  const notesEl = document.getElementById("notes");
  if (document.activeElement !== notesEl) {
    notesEl.value = today.notes || "";
  }

  // Meals
  ["breakfast", "lunch", "snack", "dinner"].forEach((meal) => {
    const el = document.getElementById(`meal-${meal}`);
    const idea = ideaFor(meal, activeDay);
    el.placeholder = "e.g. " + idea;
    if (document.activeElement !== el) {
      el.value = (today.meals && today.meals[meal]) || "";
    }
    const link = document.getElementById(`meal-${meal}-link`);
    if (link) {
      link.href = youtubeSearchUrl(idea);
      link.textContent = `▶ watch: ${idea}`;
    }
  });
}

// Event bindings
document.getElementById("sys").addEventListener("input", (e) => {
  const d = loadDay(activeDay); d.sys = e.target.value; saveDay(activeDay, d); render();
});
document.getElementById("dia").addEventListener("input", (e) => {
  const d = loadDay(activeDay); d.dia = e.target.value; saveDay(activeDay, d); render();
});
document.getElementById("sodium-add").addEventListener("click", () => {
  const input = document.getElementById("sodium-input");
  const v = Number(input.value);
  if (v > 0) {
    const d = loadDay(activeDay); d.sodium += v; saveDay(activeDay, d);
    input.value = ""; render();
  }
});
document.getElementById("sodium-clear").addEventListener("click", () => {
  const d = loadDay(activeDay); d.sodium = 0; saveDay(activeDay, d); render();
});
document.getElementById("sleep-slider").addEventListener("input", (e) => {
  const d = loadDay(activeDay); d.sleep = Number(e.target.value); saveDay(activeDay, d); render();
});
document.getElementById("workout-toggle").addEventListener("click", () => {
  const d = loadDay(activeDay); d.workout = !d.workout; saveDay(activeDay, d); render();
});
document.getElementById("notes").addEventListener("input", (e) => {
  const d = loadDay(activeDay); d.notes = e.target.value; saveDay(activeDay, d);
});
["breakfast", "lunch", "snack", "dinner"].forEach((meal) => {
  document.getElementById(`meal-${meal}`).addEventListener("input", (e) => {
    const d = loadDay(activeDay);
    d.meals = d.meals || { breakfast: "", lunch: "", snack: "", dinner: "" };
    d.meals[meal] = e.target.value;
    saveDay(activeDay, d);
  });
});
document.getElementById("ideas-toggle").addEventListener("click", () => {
  const body = document.getElementById("ideas-body");
  const caret = document.getElementById("ideas-caret");
  const showing = body.style.display !== "none";
  body.style.display = showing ? "none" : "block";
  caret.textContent = showing ? "show" : "hide";
  if (!showing && body.innerHTML === "") {
    const order = ["breakfast", "lunch", "snack", "dinner"];
    const labels = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner" };
    body.innerHTML = order.map((m) => `
      <div style="margin-bottom:12px;">
        <div style="font-family:'JetBrains Mono',monospace; font-size:11px; color:#8FA4BC; margin-bottom:4px;">${labels[m].toUpperCase()}</div>
        <ul style="margin:0; padding-left:18px; font-size:13px; color:#EDEDE4; line-height:1.8;">
          ${MEAL_IDEAS[m].map((idea) => `
            <li>
              ${idea}
              <a href="${youtubeSearchUrl(idea)}" target="_blank" rel="noopener" style="color:#E8A33D; text-decoration:none; font-family:'JetBrains Mono',monospace; font-size:11px; margin-left:6px;">▶ watch</a>
            </li>
          `).join("")}
        </ul>
      </div>
    `).join("");
  }
});
document.getElementById("week-prev").addEventListener("click", () => {
  weekOffset -= 1;
  activeDay = weekDates(weekOffset)[0];
  render();
});
document.getElementById("week-next").addEventListener("click", () => {
  if (weekOffset >= 0) return;
  weekOffset += 1;
  const dates = weekDates(weekOffset);
  activeDay = weekOffset === 0 ? todayKey() : dates[0];
  render();
});

render();

// Register service worker for offline use
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
