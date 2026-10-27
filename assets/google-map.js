if (!customElements.get("g-map")) {
  customElements.define(
    "g-map",
    class GoogleMap extends HTMLElement {
      constructor() {
        super();

        this.apiKey = this.dataset.apiKey;
        this.zoom = parseInt(this.dataset.zoom);
        this.address = this.dataset.address;
        this.map = null;

        if (!this.apiKey || !this.address) return;

        const url = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&v=weekly`;
        loadAssets(url, "g-map", () => {
          this.initMap();
        });
      }

      initMap() {
        const { scrollWheel, draggable } = this.dataset;
        this.mapContainer = this.querySelector(".map");
        this.section = this.closest(".f-map");
        const geocoder = new google.maps.Geocoder();

        geocoder.geocode({ address: this.address }, (res, status) => {
          this.section.classList.add("f-map--initialized");
          if (status !== google.maps.GeocoderStatus.OK) {
          } else {
            const mapOptions = {
              zoom: this.zoom,
              center: res[0] && res[0].geometry.location,
              draggable: draggable === "true",
              clickableIcons: false,
              scrollwheel: scrollWheel === "true",
              disableDoubleClickZoom: true,
              disableDefaultUI: true,
              styles: this.mapStyles(this.dataset.mapStyle),
            };

            this.map = new google.maps.Map(this.mapContainer, mapOptions);
            new google.maps.Marker({
              map: this.map,
              position: this.map.getCenter(),
            });
          }
        });
      }

      mapStyles(style) {
        const styles = {
          dark: [
            {
              featureType: "all",
              elementType: "labels.text.fill",
              stylers: [
                { saturation: 36 },
                { color: "#000000" },
                { lightness: 40 },
              ],
            },
            {
              featureType: "all",
              elementType: "labels.text.stroke",
              stylers: [
                { visibility: "on" },
                { color: "#000000" },
                { lightness: 16 },
              ],
            },
            {
              featureType: "all",
              elementType: "labels.icon",
              stylers: [{ visibility: "off" }],
            },
            {
              featureType: "administrative",
              elementType: "geometry.fill",
              stylers: [{ color: "#000000" }, { lightness: 20 }],
            },
            {
              featureType: "administrative",
              elementType: "geometry.stroke",
              stylers: [
                { color: "#000000" },
                { lightness: 17 },
                { weight: 1.2 },
              ],
            },
            {
              featureType: "landscape",
              elementType: "geometry",
              stylers: [{ color: "#000000" }, { lightness: 20 }],
            },
            {
              featureType: "poi",
              elementType: "geometry",
              stylers: [{ color: "#000000" }, { lightness: 21 }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry.fill",
              stylers: [{ color: "#000000" }, { lightness: 17 }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry.stroke",
              stylers: [
                { color: "#000000" },
                { lightness: 29 },
                { weight: 0.2 },
              ],
            },
            {
              featureType: "road.arterial",
              elementType: "geometry",
              stylers: [{ color: "#000000" }, { lightness: 18 }],
            },
            {
              featureType: "road.local",
              elementType: "geometry",
              stylers: [{ color: "#000000" }, { lightness: 16 }],
            },
            {
              featureType: "transit",
              elementType: "geometry",
              stylers: [{ color: "#000000" }, { lightness: 19 }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#000000" }, { lightness: 17 }],
            },
          ],
          aubergine: [
            {
              featureType: "all",
              elementType: "geometry",
              stylers: [{ color: "#1d2c4d" }],
            },
            {
              featureType: "all",
              elementType: "labels.text.fill",
              stylers: [{ color: "#8ec3b9" }],
            },
            {
              featureType: "all",
              elementType: "labels.text.stroke",
              stylers: [{ color: "#1a3646" }],
            },
            {
              featureType: "administrative.country",
              elementType: "geometry.stroke",
              stylers: [{ color: "#4b6878" }],
            },
            {
              featureType: "administrative.province",
              elementType: "geometry.stroke",
              stylers: [{ color: "#4b6878" }],
            },
            {
              featureType: "administrative.land_parcel",
              elementType: "labels.text.fill",
              stylers: [{ color: "#64779e" }],
            },
            {
              featureType: "landscape.man_made",
              elementType: "geometry.stroke",
              stylers: [{ color: "#334e87" }],
            },
            {
              featureType: "landscape.natural",
              elementType: "geometry",
              stylers: [{ color: "#023e58" }],
            },
            {
              featureType: "poi",
              elementType: "geometry",
              stylers: [{ color: "#283d6a" }],
            },
            {
              featureType: "poi",
              elementType: "labels.text.fill",
              stylers: [{ color: "#6f9ba5" }],
            },
            {
              featureType: "poi",
              elementType: "labels.text.stroke",
              stylers: [{ color: "#1d2c4d" }],
            },
            {
              featureType: "poi.park",
              elementType: "geometry.fill",
              stylers: [{ color: "#023e58" }],
            },
            {
              featureType: "poi.park",
              elementType: "labels.text.fill",
              stylers: [{ color: "#3C7680" }],
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#304a7d" }],
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#98a5be" }],
            },
            {
              featureType: "road",
              elementType: "labels.text.stroke",
              stylers: [{ color: "#1d2c4d" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry",
              stylers: [{ color: "#2c6675" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry.stroke",
              stylers: [{ color: "#255763" }],
            },
            {
              featureType: "road.highway",
              elementType: "labels.text.fill",
              stylers: [{ color: "#b0d5ce" }],
            },
            {
              featureType: "road.highway",
              elementType: "labels.text.stroke",
              stylers: [{ color: "#023e58" }],
            },
            {
              featureType: "transit",
              elementType: "labels.text.fill",
              stylers: [{ color: "#98a5be" }],
            },
            {
              featureType: "transit",
              elementType: "labels.text.stroke",
              stylers: [{ color: "#1d2c4d" }],
            },
            {
              featureType: "transit.line",
              elementType: "geometry.fill",
              stylers: [{ color: "#283d6a" }],
            },
            {
              featureType: "transit.station",
              elementType: "geometry",
              stylers: [{ color: "#3a4762" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#0e1626" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.fill",
              stylers: [{ color: "#4e6d70" }],
            },
          ],
          retro: [
            { featureType: "administrative", stylers: [{ visibility: "off" }] },
            { featureType: "poi", stylers: [{ visibility: "simplified" }] },
            {
              featureType: "road",
              elementType: "labels",
              stylers: [{ visibility: "simplified" }],
            },
            { featureType: "water", stylers: [{ visibility: "simplified" }] },
            { featureType: "transit", stylers: [{ visibility: "simplified" }] },
            {
              featureType: "landscape",
              stylers: [{ visibility: "simplified" }],
            },
            { featureType: "road.highway", stylers: [{ visibility: "off" }] },
            { featureType: "road.local", stylers: [{ visibility: "on" }] },
            {
              featureType: "road.highway",
              elementType: "geometry",
              stylers: [{ visibility: "on" }],
            },
            {
              featureType: "water",
              stylers: [{ color: "#84afa3" }, { lightness: 52 }],
            },
            { stylers: [{ saturation: -17 }, { gamma: 0.36 }] },
            {
              featureType: "transit.line",
              elementType: "geometry",
              stylers: [{ color: "#3f518c" }],
            },
          ],
          light: [
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#e9e9e9" }, { lightness: 17 }],
            },
            {
              featureType: "landscape",
              elementType: "geometry",
              stylers: [{ color: "#f5f5f5" }, { lightness: 20 }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry.fill",
              stylers: [{ color: "#ffffff" }, { lightness: 17 }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry.stroke",
              stylers: [
                { color: "#ffffff" },
                { lightness: 29 },
                { weight: 0.2 },
              ],
            },
            {
              featureType: "road.arterial",
              elementType: "geometry",
              stylers: [{ color: "#ffffff" }, { lightness: 18 }],
            },
            {
              featureType: "road.local",
              elementType: "geometry",
              stylers: [{ color: "#ffffff" }, { lightness: 16 }],
            },
            {
              featureType: "poi",
              elementType: "geometry",
              stylers: [{ color: "#f5f5f5" }, { lightness: 21 }],
            },
            {
              featureType: "poi.park",
              elementType: "geometry",
              stylers: [{ color: "#dedede" }, { lightness: 21 }],
            },
            {
              elementType: "labels.text.stroke",
              stylers: [
                { visibility: "on" },
                { color: "#ffffff" },
                { lightness: 16 },
              ],
            },
            {
              elementType: "labels.text.fill",
              stylers: [
                { saturation: 36 },
                { color: "#333333" },
                { lightness: 40 },
              ],
            },
            { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            {
              featureType: "transit",
              elementType: "geometry",
              stylers: [{ color: "#f2f2f2" }, { lightness: 19 }],
            },
            {
              featureType: "administrative",
              elementType: "geometry.fill",
              stylers: [{ color: "#fefefe" }, { lightness: 20 }],
            },
            {
              featureType: "administrative",
              elementType: "geometry.stroke",
              stylers: [
                { color: "#fefefe" },
                { lightness: 17 },
                { weight: 1.2 },
              ],
            },
          ],
          grayscale: [
            {
              featureType: "administrative",
              elementType: "all",
              stylers: [{ saturation: "-100" }],
            },
            {
              featureType: "administrative.province",
              elementType: "all",
              stylers: [{ visibility: "off" }],
            },
            {
              featureType: "landscape",
              elementType: "all",
              stylers: [
                { saturation: -100 },
                { lightness: 65 },
                { visibility: "on" },
              ],
            },
            {
              featureType: "poi",
              elementType: "all",
              stylers: [
                { saturation: -100 },
                { lightness: "50" },
                { visibility: "simplified" },
              ],
            },
            {
              featureType: "road",
              elementType: "all",
              stylers: [{ saturation: "-100" }],
            },
            {
              featureType: "road.highway",
              elementType: "all",
              stylers: [{ visibility: "simplified" }],
            },
            {
              featureType: "road.arterial",
              elementType: "all",
              stylers: [{ lightness: "30" }],
            },
            {
              featureType: "road.local",
              elementType: "all",
              stylers: [{ lightness: "40" }],
            },
            {
              featureType: "transit",
              elementType: "all",
              stylers: [{ saturation: -100 }, { visibility: "simplified" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [
                { hue: "#ffff00" },
                { lightness: -25 },
                { saturation: -97 },
              ],
            },
            {
              featureType: "water",
              elementType: "labels",
              stylers: [{ lightness: -25 }, { saturation: -100 }],
            },
          ],
          default: [],
        };
        return styles[style];
      }
    }
  );
}
