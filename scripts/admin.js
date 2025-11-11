import { supabase, PROJECTS_TABLE, STORAGE_BUCKET } from "./supabaseClient.js";

const authSection = document.querySelector("[data-admin-auth]");
const dashboardSection = document.querySelector("[data-admin-dashboard]");
const loginForm = document.getElementById("admin-login-form");
const projectsList = document.querySelector("[data-admin-projects]");
const addButton = document.querySelector("[data-admin-add]");
const refreshButton = document.querySelector("[data-admin-refresh]");
const signOutButton = document.querySelector("[data-admin-signout]");
const editorSection = document.querySelector("[data-admin-editor]");
const editorTitle = document.querySelector("[data-admin-editor-title]");
const cancelButton = document.querySelector("[data-admin-cancel]");
const deleteButton = document.querySelector("[data-admin-delete]");
const editorError = document.querySelector("[data-admin-editor-error]");
const editorSuccess = document.querySelector("[data-admin-editor-success]");
const thumbnailPreview = document.querySelector("[data-admin-thumbnail-preview]");
const galleryContainer = document.querySelector("[data-admin-gallery]");
const loginError = document.querySelector("[data-admin-error]");
const projectForm = document.getElementById("admin-project-form");

let projectsCache = [];
let currentProject = null;
let pendingGalleryUploads = [];
let galleryRemovals = new Set();
let pendingThumbnailFile = null;

const resetPendingMedia = () => {
  pendingGalleryUploads.forEach((item) => URL.revokeObjectURL(item.preview));
  pendingGalleryUploads = [];
  galleryRemovals.clear();
  pendingThumbnailFile = null;
};

const toPublicUrl = (path) => {
  if (!path) return null;
  if (/^https?:/i.test(path)) return path;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? path;
};

const showAuth = () => {
  dashboardSection.hidden = true;
  authSection.hidden = false;
};

const showDashboard = () => {
  authSection.hidden = true;
  dashboardSection.hidden = false;
};

const setLoadingState = (isLoading) => {
  projectForm.querySelectorAll("input, textarea, button").forEach((el) => {
    el.disabled = isLoading;
  });
};

const renderProjectsList = (projects) => {
  projectsList.innerHTML = "";

  if (!projects.length) {
    const empty = document.createElement("p");
    empty.className = "admin__empty";
    empty.textContent = "No projects yet. Add your first one!";
    projectsList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  projects.forEach((project) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "admin__list-item";
    item.dataset.projectId = project.id;
    if (currentProject?.id === project.id) {
      item.classList.add("is-active");
    }

    const title = document.createElement("h3");
    title.textContent = project.title ?? "Untitled project";

    const meta = document.createElement("span");
    const flags = [];
    if (project.is_featured) flags.push("Featured");
    if (project.launched_on) flags.push(project.launched_on);
    meta.textContent = flags.join(" · ") || "Draft";

    item.append(title, meta);

    item.addEventListener("click", () => openEditor(project));

    fragment.appendChild(item);
  });

  projectsList.appendChild(fragment);
};

const loadProjects = async () => {
  projectsList.innerHTML = '<p class="admin__empty">Fetching projects…</p>';
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    projectsList.innerHTML = "";
    const err = document.createElement("p");
    err.className = "admin__empty";
    err.textContent = "Failed to load projects.";
    projectsList.appendChild(err);
    throw error;
  }
  projectsCache = data ?? [];
  renderProjectsList(projectsCache);
};

const resetEditor = () => {
  currentProject = null;
  editorTitle.textContent = "New project";
  projectForm.reset();
  thumbnailPreview.textContent = "None selected";
  thumbnailPreview.innerHTML = "";
  galleryContainer.innerHTML = "";
  deleteButton.hidden = true;
  editorError.hidden = true;
  editorSuccess.hidden = true;
  resetPendingMedia();
};

const openEditor = (project = null) => {
  editorSection.hidden = false;
  resetEditor();

  if (!project) return;

  currentProject = project;
  editorTitle.textContent = `Editing: ${project.title ?? "Untitled"}`;
  deleteButton.hidden = false;

  projectForm.elements.id.value = project.id;
  projectForm.elements.title.value = project.title ?? "";
  projectForm.elements.summary.value = project.summary ?? "";
  projectForm.elements.tech_stack.value = project.tech_stack ?? "";
  projectForm.elements.launched_on.value = project.launched_on ?? "";
  projectForm.elements.cta_url.value = project.cta_url ?? "";
  projectForm.elements.is_featured.checked = Boolean(project.is_featured);

  if (project.thumbnail_url) {
    const img = document.createElement("img");
    img.src = toPublicUrl(project.thumbnail_url);
    img.alt = `${project.title} thumbnail`;
    thumbnailPreview.innerHTML = "";
    thumbnailPreview.appendChild(img);
  } else {
    thumbnailPreview.textContent = "None selected";
  }

  const gallery = Array.isArray(project.gallery_urls) ? project.gallery_urls : [];
  galleryContainer.innerHTML = "";
  if (!gallery.length) {
    const empty = document.createElement("div");
    empty.className = "admin__empty";
    empty.textContent = "No gallery images";
    galleryContainer.appendChild(empty);
  } else {
    gallery.forEach((path) => {
      const item = document.createElement("div");
      item.className = "admin__gallery-item";

      const img = document.createElement("img");
      img.src = toPublicUrl(path);
      img.alt = `${project.title} gallery image`;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "admin__gallery-remove";
      removeBtn.innerHTML = "×";
      removeBtn.addEventListener("click", () => {
        galleryRemovals.add(path);
        item.remove();
      });

      item.append(img, removeBtn);
      galleryContainer.appendChild(item);
    });
  }
};

const ensureSession = async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    showDashboard();
    await loadProjects();
  } else {
    showAuth();
  }
};

const handleLogin = async (event) => {
  event.preventDefault();
  loginError.hidden = true;

  const formData = new FormData(loginForm);
  const email = formData.get("email");
  const password = formData.get("password");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
    return;
  }

  await ensureSession();
};

const handleSignOut = async () => {
  await supabase.auth.signOut();
  showAuth();
};

const handleThumbnailChange = (event) => {
  const file = event.target.files?.[0];
  pendingThumbnailFile = file ?? null;
  thumbnailPreview.innerHTML = "";
  if (file) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = `${file.name} preview`;
    thumbnailPreview.appendChild(img);
  } else {
    thumbnailPreview.textContent = "None selected";
  }
};

const handleGalleryChange = (event) => {
  const files = Array.from(event.target.files ?? []);
  if (!files.length) return;

  const currentGalleryCount = (Array.isArray(currentProject?.gallery_urls) ? currentProject.gallery_urls.length : 0) - galleryRemovals.size;
  const remainingSlots = 10 - currentGalleryCount - pendingGalleryUploads.length;
  const acceptedFiles = files.slice(0, Math.max(0, remainingSlots));

  acceptedFiles.forEach((file) => {
    const preview = URL.createObjectURL(file);
    pendingGalleryUploads.push({ file, preview });

    const item = document.createElement("div");
    item.className = "admin__gallery-item";

    const img = document.createElement("img");
    img.src = preview;
    img.alt = file.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "admin__gallery-remove";
    removeBtn.innerHTML = "×";
    removeBtn.addEventListener("click", () => {
      URL.revokeObjectURL(preview);
      pendingGalleryUploads = pendingGalleryUploads.filter((entry) => entry.preview !== preview);
      item.remove();
    });

    item.append(img, removeBtn);
    galleryContainer.appendChild(item);
  });

  event.target.value = "";
};

const uploadFileToStorage = async (projectId, file, prefix) => {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = `${prefix}-${Date.now()}.${ext}`;
  const path = `project-${projectId}/${fileName}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw error;
  return path;
};

const removeStorageFiles = async (paths = []) => {
  const filtered = paths.filter(Boolean);
  if (!filtered.length) return;
  await supabase.storage.from(STORAGE_BUCKET).remove(filtered);
};

const collectFormData = () => {
  const formData = new FormData(projectForm);
  return {
    title: formData.get("title")?.toString().trim() ?? "",
    summary: formData.get("summary")?.toString().trim() ?? "",
    tech_stack: formData.get("tech_stack")?.toString().trim() ?? "",
    launched_on: formData.get("launched_on")?.toString().trim() ?? "",
    cta_url: formData.get("cta_url")?.toString().trim() ?? "",
    is_featured: Boolean(formData.get("is_featured")),
  };
};

const handleFormSubmit = async (event) => {
  event.preventDefault();
  editorError.hidden = true;
  editorSuccess.hidden = true;
  setLoadingState(true);

  try {
    const payload = collectFormData();

    if (!currentProject) {
      const { data, error } = await supabase
        .from(PROJECTS_TABLE)
        .insert({
          ...payload,
          gallery_urls: [],
        })
        .select()
        .single();

      if (error) throw error;

      let updated = data;

      if (pendingThumbnailFile) {
        const path = await uploadFileToStorage(data.id, pendingThumbnailFile, "thumbnail");
        const { data: updatedThumb, error: thumbErr } = await supabase
          .from(PROJECTS_TABLE)
          .update({ thumbnail_url: path })
          .eq("id", data.id)
          .select()
          .single();
        if (thumbErr) throw thumbErr;
        updated = updatedThumb;
      }

      if (pendingGalleryUploads.length) {
        const newPaths = [];
        for (const [index, entry] of pendingGalleryUploads.entries()) {
          const path = await uploadFileToStorage(data.id, entry.file, `gallery-${index}`);
          newPaths.push(path);
        }
        const { data: updatedGallery, error: galleryErr } = await supabase
          .from(PROJECTS_TABLE)
          .update({ gallery_urls: newPaths })
          .eq("id", data.id)
          .select()
          .single();
        if (galleryErr) throw galleryErr;
        updated = updatedGallery;
      }

      editorSuccess.textContent = "Project created.";
      editorSuccess.hidden = false;
      projectsCache.unshift(updated);
      renderProjectsList(projectsCache);
      openEditor(updated);
    } else {
      const updatePayload = { ...payload };

      let galleryUrls = Array.isArray(currentProject.gallery_urls) ? [...currentProject.gallery_urls] : [];

      if (galleryRemovals.size) {
        galleryUrls = galleryUrls.filter((url) => !galleryRemovals.has(url));
        await removeStorageFiles(Array.from(galleryRemovals));
      }

      if (pendingGalleryUploads.length) {
        const startIndex = galleryUrls.length;
        for (const [i, entry] of pendingGalleryUploads.entries()) {
          const path = await uploadFileToStorage(currentProject.id, entry.file, `gallery-${startIndex + i}`);
          galleryUrls.push(path);
        }
      }

      updatePayload.gallery_urls = galleryUrls.slice(0, 10);

      if (pendingThumbnailFile) {
        const path = await uploadFileToStorage(currentProject.id, pendingThumbnailFile, "thumbnail");
        updatePayload.thumbnail_url = path;
        if (currentProject.thumbnail_url) {
          await removeStorageFiles([currentProject.thumbnail_url]);
        }
      }

      const { data, error } = await supabase
        .from(PROJECTS_TABLE)
        .update(updatePayload)
        .eq("id", currentProject.id)
        .select()
        .single();

      if (error) throw error;

      editorSuccess.textContent = "Project saved.";
      editorSuccess.hidden = false;

      projectsCache = projectsCache.map((project) => (project.id === data.id ? data : project));
      renderProjectsList(projectsCache);
      openEditor(data);
    }
  } catch (error) {
    editorError.textContent = error.message ?? "Something went wrong.";
    editorError.hidden = false;
    console.error(error);
  } finally {
    setLoadingState(false);
  }
};

const handleDelete = async () => {
  if (!currentProject) return;
  const confirmDelete = window.confirm("Delete this project? This cannot be undone.");
  if (!confirmDelete) return;

  setLoadingState(true);
  editorError.hidden = true;
  editorSuccess.hidden = true;

  const mediaToRemove = [];
  if (currentProject.thumbnail_url) mediaToRemove.push(currentProject.thumbnail_url);
  if (Array.isArray(currentProject.gallery_urls)) mediaToRemove.push(...currentProject.gallery_urls);

  try {
    const { error } = await supabase.from(PROJECTS_TABLE).delete().eq("id", currentProject.id);
    if (error) throw error;

    await removeStorageFiles(mediaToRemove);

    projectsCache = projectsCache.filter((project) => project.id !== currentProject.id);
    renderProjectsList(projectsCache);
    resetEditor();
    editorSection.hidden = true;
  } catch (error) {
    editorError.textContent = error.message ?? "Failed to delete.";
    editorError.hidden = false;
  } finally {
    setLoadingState(false);
  }
};

const handleCancel = () => {
  resetEditor();
  editorSection.hidden = true;
};

loginForm?.addEventListener("submit", handleLogin);
addButton?.addEventListener("click", () => openEditor());
refreshButton?.addEventListener("click", () => loadProjects().catch(console.error));
signOutButton?.addEventListener("click", handleSignOut);
cancelButton?.addEventListener("click", handleCancel);
deleteButton?.addEventListener("click", handleDelete);
projectForm?.addEventListener("submit", handleFormSubmit);

projectForm?.elements.thumbnail?.addEventListener("change", handleThumbnailChange);
projectForm?.elements.gallery?.addEventListener("change", handleGalleryChange);

supabase.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    showAuth();
  }
});

ensureSession().catch((error) => {
  console.error(error);
  showAuth();
});
