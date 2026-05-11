export const SERVICE_RATE_TYPE_OPTIONS = [
  "Per session",
  "Per Day",
  "Fix Price",
  "Starting Price",
];

export const SERVICE_CONTACT_PREFERENCES = ["In-app chat", "Phone call", "SMS/Text", "Email", "Any"];

/** Shown directly under Service category when “Transport Services” is selected; also listed in dynamic payload. */
export const TRANSPORT_SERVICES_MODE_FIELD = {
  key: "transportModes",
  label: "Service title",
  type: "multiselect",
  allowCustom: true,
  options: ["Tricycle", "Hatid/Sunod", "Delivery rider", "Jeepney", "Padala / Pasabuy", "Lipat-bahay"],
};

export const SERVICE_DYNAMIC_FIELDS_BY_CATEGORY = {
  transport_services: [TRANSPORT_SERVICES_MODE_FIELD],
  home_repair_services: [
    { key: "repairType", label: "Repair Type", type: "select", options: ["Plumbing", "Electrical", "Carpentry", "Appliance Repair", "General Repair"] },
    { key: "homeService", label: "Home Service", type: "toggle" },
    { key: "emergencyService", label: "Emergency Service", type: "toggle" },
    { key: "experienceYears", label: "Experience Years", type: "number", min: 0, placeholder: "e.g. 5" },
    { key: "materialsIncluded", label: "Materials Included", type: "toggle" },
    { key: "warrantyOffered", label: "Warranty Offered", type: "toggle" },
    { key: "certifications", label: "Certifications (optional)", type: "text", placeholder: "Licenses or certifications" },
    { key: "toolsIncluded", label: "Tools Included (optional)", type: "text", placeholder: "Tools you bring" },
  ],
  beauty_wellness: [
    { key: "homeService", label: "Home Service", type: "toggle" },
    { key: "appointmentRequired", label: "Appointment Required", type: "toggle" },
    {
      key: "genderPreference",
      label: "Gender Preference",
      type: "select",
      options: ["No preference", "Female clients only", "Male clients only"],
      /** Not shown as service-title quick picks; keep on the detail grid only. */
      excludeFromServiceTitleQuickPicks: true,
    },
    { key: "servicesOffered", label: "Services Offered", type: "multiselect", options: ["Massage", "Nail Polish", "Haircut", "Makeup", "Facial", "Spa"] },
    { key: "sessionDurationMinutes", label: "Session Duration (minutes)", type: "number", min: 0, placeholder: "e.g. 60" },
    { key: "productsIncluded", label: "Products Included", type: "toggle" },
  ],
  pet_care_services: [
    { key: "petTypesAccepted", label: "Pet Types Accepted", type: "multiselect", options: ["Dog", "Cat", "Bird", "Rabbit", "Fish", "Other"] },
    { key: "petSizeAccepted", label: "Pet Size Accepted", type: "multiselect", options: ["Small", "Medium", "Large", "Any"] },
    { key: "pickupAvailable", label: "Pickup Available", type: "toggle" },
    { key: "mobileGrooming", label: "Mobile Grooming", type: "toggle" },
    { key: "cageAvailable", label: "Cage Available", type: "toggle" },
    { key: "groomingServices", label: "Grooming Services", type: "multiselect", options: ["Bath", "Hair Trim", "Nail Trim", "Teeth Cleaning", "Ear Cleaning"] },
  ],
  cleaning_services: [
    { key: "cleaningType", label: "Cleaning Type", type: "select", options: ["House Cleaning", "Laundry", "Car Wash", "Deep Cleaning", "Office Cleaning"] },
    { key: "suppliesIncluded", label: "Supplies Included", type: "toggle" },
    { key: "teamSize", label: "Team Size", type: "number", min: 1, placeholder: "e.g. 2" },
    { key: "areaSizeLimit", label: "Area Size Limit", type: "text", placeholder: "e.g. up to 120 sqm" },
    { key: "sameDayService", label: "Same Day Service", type: "toggle" },
  ],
  delivery_errands: [
    { key: "vehicleUsed", label: "Vehicle Used", type: "select", options: ["Bike", "Motorbike", "Car", "Public Transport", "On Foot"] },
    { key: "maxWeightKg", label: "Max Weight (kg)", type: "number", min: 0, placeholder: "e.g. 8" },
    { key: "deliveryRadiusKm", label: "Delivery Radius (km)", type: "number", min: 0, placeholder: "e.g. 10" },
    { key: "codSupported", label: "COD Supported", type: "toggle" },
    { key: "rushDelivery", label: "Rush Delivery", type: "toggle" },
  ],
  education_tutorials: [
    { key: "subjectExpertise", label: "Subject Expertise", type: "multiselect", options: ["Math", "Science", "English", "ESL", "Music", "Programming"] },
    { key: "onlineAvailable", label: "Online Available", type: "toggle" },
    { key: "homeTutoring", label: "Home Tutoring", type: "toggle" },
    { key: "educationLevel", label: "Education Level", type: "select", options: ["Elementary", "High School", "College", "Professional", "All Levels"] },
    { key: "sessionDurationMinutes", label: "Session Duration (minutes)", type: "number", min: 0, placeholder: "e.g. 90" },
  ],
  fitness_sports: [
    { key: "fitnessType", label: "Fitness Type", type: "select", options: ["Personal Training", "Running Coach", "Yoga", "Strength", "Cardio"] },
    { key: "homeTraining", label: "Home Training", type: "toggle" },
    { key: "groupSessions", label: "Group Sessions", type: "toggle" },
    { key: "equipmentIncluded", label: "Equipment Included", type: "toggle" },
  ],
  events_freelance: [
    { key: "eventType", label: "Event Type", type: "multiselect", options: ["Wedding", "Birthday", "Corporate", "School Event", "Private Event"] },
    { key: "packageType", label: "Package Type", type: "select", options: ["Basic", "Standard", "Premium", "Custom"] },
    { key: "equipmentIncluded", label: "Equipment Included", type: "toggle" },
    { key: "travelAllowed", label: "Travel Allowed", type: "toggle" },
  ],
};

export const SERVICE_CATEGORY_OPTIONS = [
  { id: "transport_services", label: "Transport Services", examples: "" },
  { id: "home_repair_services", label: "Home Repair Services", examples: "Plumbing, Electrical, Carpenter, Appliance Repair" },
  { id: "beauty_wellness", label: "Beauty & Wellness", examples: "Massage, Nail Polish, Haircut, Makeup Artist" },
  { id: "pet_care_services", label: "Pet Care Services", examples: "Pet Grooming, Pet Sitting, Pet Boarding" },
  { id: "cleaning_services", label: "Cleaning Services", examples: "House Cleaning, Laundry, Car Wash" },
  { id: "delivery_errands", label: "Delivery & Errands", examples: "Grocery Pasabuy, Medicine Pickup, Queueing Service" },
  { id: "education_tutorials", label: "Education & Tutorials", examples: "Tutor, Music Lessons, ESL" },
  { id: "fitness_sports", label: "Fitness & Sports", examples: "Personal Trainer, Running Coach, Yoga Instructor" },
  { id: "events_freelance", label: "Events & Freelance", examples: "Photographer, Videographer, DJ, Host" },
];

/**
 * Suggestions for the “Service title” quick-add row (select + multiselect option labels from that category’s form config).
 * Transport uses {@link TRANSPORT_SERVICES_MODE_FIELD} instead.
 * @param {string} categoryId
 * @returns {string[]}
 */
export function getServiceTitleQuickPickOptions(categoryId) {
  const cat = String(categoryId || "");
  if (cat === "transport_services") {
    return [...(TRANSPORT_SERVICES_MODE_FIELD.options || [])];
  }
  const fields = SERVICE_DYNAMIC_FIELDS_BY_CATEGORY[cat] || [];
  const seen = new Set();
  const out = [];
  for (const f of fields) {
    if (f.excludeFromServiceTitleQuickPicks) continue;
    if ((f.type === "multiselect" || f.type === "select") && Array.isArray(f.options)) {
      for (const opt of f.options) {
        const s = String(opt || "").trim();
        if (!s) continue;
        const k = s.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(s);
      }
    }
  }
  return out;
}

/**
 * Detail grid: toggles, numbers, text, and select/multiselect with
 * `excludeFromServiceTitleQuickPicks`. Other select/multiselect are omitted
 * (their options are covered by the service title quick picks).
 * @param {string} categoryId
 */
export function getServiceDetailGridDynamicFields(categoryId) {
  const cat = String(categoryId || "");
  const fields = SERVICE_DYNAMIC_FIELDS_BY_CATEGORY[cat] || [];
  return fields.filter((f) => {
    if (cat === "transport_services" && f.key === TRANSPORT_SERVICES_MODE_FIELD.key) return false;
    if ((f.type === "select" || f.type === "multiselect") && !f.excludeFromServiceTitleQuickPicks) return false;
    return true;
  });
}

/**
 * Fills `dynamicFields` labels for select/multiselect hidden from the grid:
 * values are inferred from a comma-separated service title when segments match
 * configured option strings (case-insensitive).
 * @param {string} categoryId
 * @param {string} titleStr
 * @returns {Record<string, string | string[]>}
 */
export function deriveServiceDynamicPayloadFromTitle(categoryId, titleStr) {
  const cat = String(categoryId || "");
  if (cat === "transport_services") return {};
  const segments = [];
  const seenSeg = new Set();
  for (const part of String(titleStr || "").split(",")) {
    const t = part.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seenSeg.has(k)) continue;
    seenSeg.add(k);
    segments.push({ lower: k });
  }
  const fields = SERVICE_DYNAMIC_FIELDS_BY_CATEGORY[cat] || [];
  /** @type {Record<string, string | string[]>} */
  const out = {};
  for (const f of fields) {
    if (f.excludeFromServiceTitleQuickPicks) continue;
    if (f.type !== "select" && f.type !== "multiselect") continue;
    if (!Array.isArray(f.options)) continue;
    if (f.type === "multiselect") {
      const matched = f.options.filter((opt) => segments.some((s) => String(opt).toLowerCase() === s.lower));
      if (matched.length) out[f.label] = matched;
    } else {
      const hit = segments.find((s) => f.options.some((opt) => String(opt).toLowerCase() === s.lower));
      if (hit) {
        const val = f.options.find((opt) => String(opt).toLowerCase() === hit.lower);
        if (val !== undefined) out[f.label] = val;
      }
    }
  }
  return out;
}

export function createServiceDynamicDefaults() {
  const out = {};
  Object.values(SERVICE_DYNAMIC_FIELDS_BY_CATEGORY).forEach((fields) => {
    fields.forEach((field) => {
      if (field.type === "toggle") out[field.key] = false;
      else if (field.type === "multiselect") out[field.key] = [];
      else out[field.key] = "";
    });
  });
  return out;
}
