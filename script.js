const API_BASE = "http://127.0.0.1:5000";

const form = document.getElementById("estForm");
const submitBtn = document.getElementById("submitBtn");
const formError = document.getElementById("formError");
const stamp = document.getElementById("stamp");
const stampPrice = document.getElementById("stampPrice");
const resultNote = document.getElementById("resultNote");
const resultBreakdown = document.getElementById("resultBreakdown");
const modelStatus = document.getElementById("modelStatus");
const furnishingGroup = document.getElementById("furnishing");

/* ---------- furnishing segmented control ---------- */
furnishingGroup.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  furnishingGroup.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  furnishingGroup.dataset.value = btn.dataset.value;
});

/* ---------- live "sketch" preview reacts to inputs ---------- */
const prevAC = document.getElementById("prevAC");
const prevGarage = document.getElementById("prevGarage");
const prevWinL = document.getElementById("prevWinL");
const prevWinR = document.getElementById("prevWinR");

function updatePreview() {
  prevAC.style.opacity = document.getElementById("airconditioning").checked ? "1" : "0.12";
  prevGarage.style.opacity = Number(document.getElementById("parking").value) > 0 ? "1" : "0.12";
  const stories = Number(document.getElementById("stories").value) || 1;
  const winStroke = stories > 1 ? "#C99A3E" : "#17222E";
  prevWinL.setAttribute("stroke", winStroke);
  prevWinR.setAttribute("stroke", winStroke);
}
["airconditioning", "parking", "stories"].forEach((id) => {
  document.getElementById(id).addEventListener("change", updatePreview);
  document.getElementById(id).addEventListener("input", updatePreview);
});
updatePreview();

/* ---------- backend health check ---------- */
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    modelStatus.textContent = data.model_ready ? "ready" : "not trained yet";
  } catch {
    modelStatus.textContent = "backend offline";
  }
}
checkHealth();

/* ---------- helpers ---------- */
function yesNo(id) {
  return document.getElementById(id).checked ? "yes" : "no";
}

function formatBreakdownItem(label, value) {
  const li = document.createElement("li");
  li.innerHTML = `${label}<strong>${value}</strong>`;
  return li;
}

/* ---------- submit ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  const payload = {
    area: Number(document.getElementById("area").value),
    bedrooms: Number(document.getElementById("bedrooms").value),
    bathrooms: Number(document.getElementById("bathrooms").value),
    stories: Number(document.getElementById("stories").value),
    parking: Number(document.getElementById("parking").value),
    mainroad: yesNo("mainroad"),
    guestroom: yesNo("guestroom"),
    basement: yesNo("basement"),
    hotwaterheating: yesNo("hotwaterheating"),
    airconditioning: yesNo("airconditioning"),
    prefarea: yesNo("prefarea"),
    furnishingstatus: furnishingGroup.dataset.value,
  };

  if (!payload.area || payload.area <= 0) {
    formError.textContent = "Please enter a valid area in sq ft.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Calculating…";

  try {
    const res = await fetch(`${API_BASE}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");

    stamp.classList.remove("revealed");
    void stamp.offsetWidth; // restart animation
    stampPrice.textContent = data.formatted_price;
    stamp.classList.add("revealed");

    resultNote.textContent =
      `Based on a ${payload.area.toLocaleString("en-IN")} sq ft, ${payload.bedrooms}-bedroom home ` +
      `with ${payload.bathrooms} bathroom(s) across ${payload.stories} stor${payload.stories > 1 ? "ies" : "y"}, ` +
      `the model estimates the market value shown at left.`;

    resultBreakdown.innerHTML = "";
    resultBreakdown.appendChild(formatBreakdownItem("Furnishing", payload.furnishingstatus));
    resultBreakdown.appendChild(formatBreakdownItem("Parking spaces", payload.parking));
    resultBreakdown.appendChild(formatBreakdownItem("Preferred area", payload.prefarea));

    document.getElementById("resultSection").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (err) {
    formError.textContent =
      err.message === "Failed to fetch"
        ? "Can't reach the backend. Make sure `python app.py` is running on port 5000."
        : err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Calculate estimated value";
  }
});
