document.addEventListener("DOMContentLoaded", () => {
  const locations = [
    {
      name: "Ireland",
      image: "https://cdn.shopify.com/s/files/1/0943/9553/1577/files/Flag-Ireland.png?v=1752707516",
      lat: -20,
      lon: -45,
      clubs: [
        {
          name: "County Sligo Golf Club",
          url: "/pages/clubs/county-sligo-golf-club",
          new: false,
          image: "https://cdn.shopify.com/s/files/1/0927/3632/3908/files/CountySligo.png?v=1749230465"
        },
        {
          name: "Dingle Golf Links",
          url: "/pages/clubs/dingle-golf-links",
          new: false,
          image: "https://cdn.shopify.com/s/files/1/0943/9553/1577/files/DingleGolfClub_Logo_color.png?v=1749068245"
        },
        {
          name: "Dooks Golf Links",
          url: "/pages/clubs/dooks-golf-club",
          new: false,
          image: "https://cdn.shopify.com/s/files/1/0943/9553/1577/files/DooksGolfClub_Logo_color.png?v=1749068256"
        },
        {
          name: "Dromoland Castle",
          url: "/pages/clubs/dromoland-golf-club",
          new: false,
          image: "https://cdn.shopify.com/s/files/1/0943/9553/1577/files/DromolandGolfClub_Logo_black.png?v=1749068259"
        },
        {
          name: "Portmarnock Golf Club",
          url: "/pages/clubs/portmarnock",
          new: false,
          image: "https://cdn.shopify.com/s/files/1/0943/9553/1577/files/PortmarnockGolfClub_Logo_color.png?v=1749068816"
        },
        {
          name: "Powerscourt",
          url: "/pages/clubs/powerscourt",
          new: false,
          image: "https://cdn.shopify.com/s/files/1/0927/3632/3908/files/powerscourt.jpg?v=1755196396"
        }
      ]
    },
    {
      name: "Scotland",
      image: "https://cdn.shopify.com/s/files/1/0943/9553/1577/files/Flag-Scottland.png?v=1752707516",
      lat: 34,
      lon: -5,
      clubs: [
        {
          name: "Barassie Links",
          url: "/pages/clubs/barassie-links",
          new: true,
          image: "https://cdn.shopify.com/s/files/1/0927/3632/3908/files/Barassie-Links-logo-color.png?v=1758150142"
        }
      ]
    },
    {
      name: "UK",
      image: "https://cdn.shopify.com/s/files/1/0943/9553/1577/files/Flag-UK.png?v=1752707516",
      lat: -40,
      lon: 25,
      clubs: [
        {
          name: "Royal St George",
          url: "/pages/clubs/royal-st-george",
          new: false,
          image: "https://cdn.shopify.com/s/files/1/0927/3632/3908/files/Logo_Royal_St._George_s_Red.svg?v=1755625058"
        }
      ]
    },
    {
      name: "Wales",
      image: "https://cdn.shopify.com/s/files/1/0927/3632/3908/files/Flag_of_Wales.png?v=1754953631",
      lat: -30,
      lon: 0,
      clubs: []
    }
  ];

  const map = document.getElementsByClassName('world-map')[0];
  const container = document.getElementsByClassName('map-container')[0];
  const tooltip = document.getElementsByClassName('tooltip-marker')[0];
  const markers = [];

  function project(lat, lon, mapWidth, mapHeight) {
    const x = (lon + 180) * (mapWidth / 360);
    const latRad = lat * Math.PI / 180;
    const mercN = Math.log(Math.tan((Math.PI / 4) + (latRad / 2)));
    const y = (mapHeight / 2) - (mapWidth * mercN / (2 * Math.PI));
    return { x, y };
  }

  function createMarker(loc) {
    const marker = document.createElement("div");
    marker.className = "marker-map";
    marker.title = loc.name;
    marker.style.animationDelay = `${Math.random()}s`;

    let hideTooltipTimeout = null;
    let isHoveringTooltip = false;
    let currentHoveredMarker = null;

    // Show tooltip on marker hover
    marker.addEventListener("mouseenter", () => {
      clearTimeout(hideTooltipTimeout);
      currentHoveredMarker = marker;

      let html = `<div class="country-info">`;
      html += `<img class="country-flag" src="${loc.image}" alt="${loc.name}">`;
      html += `<p class="country-name">${loc.name}</p>`;
      html += `</div>`;

      if (loc.clubs && loc.clubs.length > 0) {
        html += `<div class="clubs-info">`;
        html += `<p>Clubs: <strong>${loc.clubs.length}</strong></p>`;
        html += `<button class="button-modal" data-location='${JSON.stringify(loc)}'>View Detail</button>`;
        html += `</div>`;
      } else {
        html += `<p class="coming-soon">Coming Soon....</p>`;
      }

      tooltip.innerHTML = html;
      tooltip.style.display = "block";
      tooltip.style.left = "-9999px";
      tooltip.style.top = "-9999px";

      requestAnimationFrame(() => {
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        const { x, y } = project(loc.lat, loc.lon, map.offsetWidth, map.offsetHeight);

        tooltip.style.left = `${x - tooltipWidth / 2}px`;
        tooltip.style.top = `${y - tooltipHeight - 20}px`;
      });
    });

    marker.addEventListener("mouseleave", () => {
      hideTooltipTimeout = setTimeout(() => {
        if (!isHoveringTooltip && currentHoveredMarker === marker) {
          tooltip.style.display = "none";
          currentHoveredMarker = null;
        }
      }, 200);
    });

    tooltip.addEventListener("mouseenter", () => {
      isHoveringTooltip = true;
      clearTimeout(hideTooltipTimeout);
    });

    tooltip.addEventListener("mouseleave", () => {
      isHoveringTooltip = false;
      hideTooltipTimeout = setTimeout(() => {
        tooltip.style.display = "none";
        currentHoveredMarker = null;
      }, 200);
    });

    container.appendChild(marker);
    markers.push({ element: marker, lat: loc.lat, lon: loc.lon });
  }

  function updateMarkerPositions() {
    const mapWidth = map.offsetWidth;
    const mapHeight = map.offsetHeight;

    markers.forEach(({ element, lat, lon }) => {
      const { x, y } = project(lat, lon, mapWidth, mapHeight);
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    });
  }

  function updateMarkerPositions() {
    const mapWidth = map.offsetWidth;
    const mapHeight = map.offsetHeight;

    markers.forEach(({ element, lat, lon }) => {
      const { x, y } = project(lat, lon, mapWidth, mapHeight);
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    });
  }

  if (map.complete) {
    locations.forEach(loc => createMarker(loc));
    updateMarkerPositions();
  } else {
    map.onload = () => {
      locations.forEach(loc => createMarker(loc));
      updateMarkerPositions();
    };
  }

  const isDesktop = window.innerWidth >= 768;

  if (isDesktop) {
    initDesktopMap();
  } else {
    initMobileAccordions();
  }

  window.addEventListener("resize", () => {
    const nowDesktop = window.innerWidth >= 768;
    const wasDesktop = document.body.classList.contains("desktop-mode");

    updateMarkerPositions(); // <-- Ensure marker positions are always updated

    if (nowDesktop !== wasDesktop) {
      location.reload(); // Only reload if device mode changed
    }
  });

  function initDesktopMap() {
    document.body.classList.add("desktop-mode");

    document.addEventListener("click", (e) => {
      if (!e.target.classList.contains("marker-map")) {
        tooltip.style.display = "none";
      }

      if (e.target.matches(".button-modal")) {
        const loc = JSON.parse(e.target.dataset.location);
        const modal = document.getElementsByClassName("location-modal")[0];
        const modalBody = document.getElementsByClassName("modal-body")[0];

        let modalHTML = `<div class="country-info">`;
        modalHTML += `<img src="${loc.image}" alt="${loc.name}" class="country-flag">`;
        modalHTML += `<h6>${loc.name}</h6></div>`;

        if (loc.clubs && loc.clubs.length) {
          modalHTML += `<ul class="clubs-list">`;
          loc.clubs.forEach(club => {
            if (club.url) {
              modalHTML += `
                <li class="club-item">
                  <a href="${club.url}" target="_blank">
                    <div class="club-info">
                      <img class="club-image" src="${club.image}" alt="${club.name}"/>
                      <div class="club-meta">
                        <span class="club-name">${club.name}</span>
                        ${club.new ? '<span class="new-tag">New</span>' : ''}
                      </div>
                    </div>
                    <svg class="club-button" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="16" fill="#222F1D"/><path d="M14 11L19 16L14 21" stroke="white" stroke-width="1.5"/></svg>
                  </a>
                </li>`;
            } else {
              modalHTML += `
                <li class="club-item disabled">
                  <div class="club-info">
                    <img class="club-image" src="${club.image}" alt="${club.name}"/>
                    <div class="club-meta">
                      <span class="club-name">${club.name}</span>
                      <span class="coming-soon">Coming Soon</span>
                    </div>
                  </div>
                  <svg class="club-button" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="16" fill="#D1D1D1"/><path d="M14 11L19 16L14 21" stroke="white" stroke-width="1.5"/></svg>
                </li>`;
            }
          });
          modalHTML += `</ul>`;
        } else {
          modalHTML += `<p>No clubs available.</p>`;
        }

        modalBody.innerHTML = modalHTML;
        modal.classList.remove("hidden");
      }

      const modal = document.getElementsByClassName("location-modal")[0];
      if (
        modal && !modal.classList.contains("hidden") &&
        (e.target.classList.contains("location-modal") || e.target.closest(".close"))
      ) {
        modal.classList.add("hidden");
      }
    });

    window.addEventListener("resize", updateMarkerPositions);
  }

  function initMobileAccordions() {
    const container = document.querySelector(".map-container");
    const wrapper = document.createElement("div");
    wrapper.className = "accordion-wrapper";

    locations.forEach(loc => {
      const section = document.createElement("div");
      section.className = "accordion-section";

      const header = document.createElement("button");
      header.className = "accordion-header";
      header.innerHTML = loc.clubs.length > 0 ? `
        <div class="accordion-inner">
          <div class="country-info accordion-box left">
            <img src="${loc.image}" class="country-flag" alt="${loc.name}"/>
            <p style="margin: 0;" class="country-name">${loc.name}</p>
          </div>
          <div class="accordion-box right">
            <p style="margin: 0;">Clubs: <strong>${loc.clubs.length}</strong></p>
            <svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 10.0164L8 5.01642L13 10.0164" stroke="#262626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      ` : `
        <div class="accordion-inner">
          <div class="country-info accordion-box left">
            <img src="${loc.image}" class="country-flag" alt="${loc.name}"/>
            <p style="margin: 0;" class="country-name">${loc.name}</p>
          </div>
          <div class="accordion-box right">
            <p style="text-transform: uppercase; font-weight: bold; margin: 0; color: #787878;">Coming soon</p>
          </div>
        </div>
      `;

      const panel = document.createElement("div");
      panel.className = loc.clubs.length > 0 ? "accordion-panel" : "hidden";

      if (loc.clubs && loc.clubs.length) {
        const list = document.createElement("ul");
        list.className = "clubs-list";
        loc.clubs.forEach(club => {
          const li = document.createElement("li");
          li.className = club.url ? "club-item" : "club-item disabled";
          li.innerHTML = club.url ? `
            <a href="${club.url}" target="_blank">
              <div class="club-info">
                <img class="club-image" src="${club.image}" alt="${club.name}"/>
                <div class="club-meta">
                  <span class="club-name">${club.name}</span>
                  ${club.new ? '<span class="new-tag">New</span>' : ''}
                </div>
              </div>
              <svg class="club-button" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="16" fill="#222F1D"/><path d="M14 11L19 16L14 21" stroke="white" stroke-width="1.5"/></svg>
            </a>
          ` : `
            <div class="club-info">
              <img class="club-image" src="${club.image}" alt="${club.name}"/>
              <div class="club-meta">
                <span class="club-name">${club.name}</span>
                <span class="coming-soon">Coming Soon</span>
              </div>
            </div>
            <svg class="club-button" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="16" fill="#D1D1D1"/><path d="M14 11L19 16L14 21" stroke="white" stroke-width="1.5"/></svg>
          `;
          list.appendChild(li);
        });
        panel.appendChild(list);
      } else {
        panel.innerHTML = '';
      }

      section.appendChild(header);
      section.appendChild(panel);
      wrapper.appendChild(section);
    });

    container.appendChild(wrapper);

    document.querySelectorAll(".accordion-header").forEach(header => {
      header.addEventListener("click", () => {
        const panel = header.nextElementSibling;
        const isOpen = header.classList.toggle("active");
        panel.style.maxHeight = isOpen ? panel.scrollHeight + "px" : null;
      });
    });
  }
});
