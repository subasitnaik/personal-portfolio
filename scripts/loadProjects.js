import { supabase, PROJECTS_TABLE, STORAGE_BUCKET } from "./supabaseClient.js";

const featuredContainer = document.querySelector("[data-projects-featured]");
const allContainer = document.querySelector("[data-projects-all]");
const errorTemplate = (message) => {
  const div = document.createElement("div");
  div.className = "projects__empty";
  div.textContent = message;
  return div;
};

const toPublicUrl = (path) => {
  if (!path) return null;
  if (/^https?:/i.test(path)) return path;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? path;
};

const getGalleryImages = (project) => {
  const gallery = Array.isArray(project.gallery_urls) ? project.gallery_urls : [];
  if (gallery.length) {
    return gallery.map(toPublicUrl).filter(Boolean).slice(0, 10);
  }
  const fallback = toPublicUrl(project.thumbnail_url);
  return fallback ? [fallback] : [];
};

const createProjectCard = (project) => {
  const card = document.createElement("article");
  card.className = "project-card";
  card.setAttribute("data-draggable", "");

  const galleryImages = getGalleryImages(project);

  const thumbTag = project.cta_url ? "a" : "div";
  const thumb = document.createElement(thumbTag);
  thumb.className = "project-card__thumb";
  thumb.dataset.galleryInterval = String(project.gallery_interval ?? 4500);
  if (project.cta_url) {
    thumb.href = project.cta_url;
    thumb.target = "_blank";
    thumb.rel = "noopener";
  }

  if (galleryImages.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "project-card__thumb-placeholder";
    placeholder.textContent = "No preview available";
    thumb.appendChild(placeholder);
  } else {
    galleryImages.forEach((url, index) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = `${project.title} preview ${index + 1}`;
      img.loading = "lazy";
      thumb.appendChild(img);
    });
  }

  const body = document.createElement("div");
  body.className = "project-card__body";

  const title = document.createElement("h3");
  title.textContent = project.title ?? "Untitled Project";

  const meta = document.createElement("div");
  meta.className = "project-card__meta";

  if (project.tech_stack) {
    const tech = document.createElement("span");
    tech.className = "project-card__meta-channel";
    tech.textContent = project.tech_stack;
    meta.appendChild(tech);
  }

  if (project.launched_on) {
    const date = document.createElement("span");
    date.className = "project-card__meta-date";
    date.textContent = project.launched_on;
    meta.appendChild(date);
  }

  body.append(title, meta);

  card.append(thumb, body);
  return card;
};

const renderProjects = (container, projects) => {
  if (!container) return;
  container.innerHTML = "";

  if (!projects.length) {
    container.appendChild(errorTemplate("No projects yet."));
    window.dispatchEvent(new Event("projects:rendered"));
    return;
  }

  const fragment = document.createDocumentFragment();
  projects.forEach((project) => {
    fragment.appendChild(createProjectCard(project));
  });

  container.appendChild(fragment);
  window.initializeProjectGalleries?.();
  window.dispatchEvent(new Event("projects:rendered"));
};

const fetchProjects = async () => {
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
};

const hydrateProjects = async () => {
  const needsFeatured = Boolean(featuredContainer);
  const needsAll = Boolean(allContainer);
  if (!needsFeatured && !needsAll) return;

  try {
    const projects = await fetchProjects();

    if (needsFeatured) {
      const featured = projects.filter((project) => project.is_featured).slice(0, 3);
      renderProjects(featuredContainer, featured);
    }

    if (needsAll) {
      renderProjects(allContainer, projects);
    }
  } catch (error) {
    const message = "Unable to load projects right now.";
    if (needsFeatured) {
      featuredContainer.innerHTML = "";
      featuredContainer.appendChild(errorTemplate(message));
    }
    if (needsAll) {
      allContainer.innerHTML = "";
      allContainer.appendChild(errorTemplate(message));
    }
    console.error("Failed to fetch projects", error);
  }
};

hydrateProjects();
