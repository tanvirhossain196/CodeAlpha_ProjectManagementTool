import { patch } from "./api.js";
import { boot } from "./app.js";
import { initials, setButtonLoading, toast } from "./ui.js";

let user = await boot();
const form = document.querySelector("#profileForm");

function fillForm(profile) {
  const fields = {
    fullName: profile.full_name,
    username: profile.username,
    email: profile.email,
    avatarUrl: profile.avatar_url,
    jobTitle: profile.job_title,
    department: profile.department,
    phone: profile.phone,
    location: profile.location,
    bio: profile.bio,
    timezone: profile.timezone || "Asia/Dhaka"
  };
  for (const [name, value] of Object.entries(fields)) {
    if (form.elements[name]) form.elements[name].value = value || "";
  }
}

function renderPreview(profile) {
  const avatar = document.querySelector("#profileAvatar");
  avatar.textContent = initials(profile.full_name);
  avatar.style.backgroundImage = "";
  avatar.classList.toggle("has-image", Boolean(profile.avatar_url));
  if (profile.avatar_url) {
    avatar.textContent = "";
    avatar.style.backgroundImage = `url("${String(profile.avatar_url).replace(/["\\]/g, "")}")`;
  }
  document.querySelector("#profileName").textContent = profile.full_name;
  document.querySelector("#profileHandle").textContent = `@${profile.username}`;
  document.querySelector("#profileTitle").textContent = profile.job_title || "Workspace member";
  document.querySelector("#profileDepartment").textContent = profile.department || "Department not specified";
  document.querySelector("#profileLocation").textContent = profile.location || "Location not specified";
  document.querySelector("#profileBio").textContent = profile.bio || "Add a short professional summary so collaborators understand your role and operating context.";
  document.querySelector("#memberSince").textContent = profile.created_at
    ? new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(profile.created_at))
    : "—";
  const completed = [profile.full_name, profile.job_title, profile.department, profile.location, profile.bio, profile.phone, profile.avatar_url]
    .filter(Boolean).length;
  const percentage = Math.round((completed / 7) * 100);
  document.querySelector("#profileCompletion").textContent = `${percentage}%`;
  document.querySelector("#profileCompletionBar").style.width = `${percentage}%`;
}

fillForm(user);
renderPreview(user);

form.elements.avatarUrl?.addEventListener("input", () => {
  renderPreview({ ...user, full_name: form.fullName.value || user.full_name, avatar_url: form.avatarUrl.value.trim() });
});
form.elements.fullName?.addEventListener("input", () => {
  renderPreview({ ...user, full_name: form.fullName.value || user.full_name, avatar_url: form.avatarUrl.value.trim() });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("[type=submit]");
  setButtonLoading(button, true, "Saving profile…");
  const data = Object.fromEntries(new FormData(form));
  try {
    user = await patch("/users/me", data);
    localStorage.setItem("shilposetu_user", JSON.stringify(user));
    fillForm(user);
    renderPreview(user);
    document.querySelectorAll("[data-user-name]").forEach((element) => { element.textContent = user.full_name; });
    document.querySelectorAll("[data-user-initials]").forEach((element) => {
      element.textContent = initials(user.full_name);
      element.style.backgroundImage = "";
      if (user.avatar_url) {
        element.textContent = "";
        element.style.backgroundImage = `url("${String(user.avatar_url).replace(/["\\]/g, "")}")`;
      }
    });
    toast("Professional profile updated.", "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
});
