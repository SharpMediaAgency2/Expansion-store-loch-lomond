if (!customElements.get("countdown-timer")) {
  customElements.define(
    "countdown-timer",
    class CountdownTimer extends HTMLElement {
      constructor() {
        super();

        this.init();
      }

      init() {
        this.MS_IN_SEC = 1000;
        this.MS_IN_MIN = 60 * this.MS_IN_SEC;
        this.MS_IN_HRS = 60 * this.MS_IN_MIN;
        this.MS_IN_DAY = 24 * this.MS_IN_HRS;

        this.selectorMapping = {
          day: "[data-timer-day]",
          hour: "[data-timer-hour]",
          minute: "[data-timer-minute]",
          second: "[data-timer-second]",
        };
        this.units = ["day", "hour", "minute", "second"];
        this.type = this.dataset.type;
        this.duration = this.dataset.duration;
        this.loop = false;
        this.shouldAddLeadingZero = true;

        this.initCountdown();
      }

      initCountdown() {
        switch (this.type) {
          case "fixed_time":
            const countdownData = this.dataset.dueDate;
            if (countdownData) {
              this.targetTime = new Date(countdownData).getTime();
            }
            break;
          default: // Evergreen.
            this.targetTime = this.getEvergreenDueDate().getTime();
            break;
        }

        if (!this.targetTime) {
          return;
        }

        this.startTime = Date.now();
        if (this.targetTime > this.startTime) {
          this.fetchDomElements();
          this.beginCountdown();
        }
      }

      fetchDomElements() {
        this.elements = {};
        this.units.forEach((unit) => {
          this.elements[unit] = this.querySelector(this.selectorMapping[unit]);
        });
      }

      beginCountdown() {
        this.intervalId = setInterval(() => {
          const remainingTime = this.targetTime - Date.now();
          if (remainingTime <= 0) {
            this.terminateCountdown();
          } else {
            this.updateDisplay(remainingTime);
          }
        }, 1000);
        this.classList.remove("f-hidden");
      }

      updateDisplay(remainingTime) {
        const timeComponents = this.computeTimeComponents(remainingTime);
        this.units.forEach((unit) => {
          if (this.elements[unit]) {
            this.elements[unit].textContent = this.formatTimeComponent(
              timeComponents[unit]
            );
          }
        });
      }

      computeTimeComponents(ms) {
        return {
          day: Math.floor(ms / this.MS_IN_DAY),
          hour: Math.floor((ms % this.MS_IN_DAY) / this.MS_IN_HRS),
          minute: Math.floor((ms % this.MS_IN_HRS) / this.MS_IN_MIN),
          second: Math.floor((ms % this.MS_IN_MIN) / this.MS_IN_SEC),
        };
      }

      formatTimeComponent(value) {
        return this.shouldAddLeadingZero && value < 10
          ? `0${value}`
          : value.toString();
      }

      terminateCountdown() {
        clearInterval(this.intervalId);
        if (this.loop) {
          this.beginCountdown();
        } else {
          this.classList.add("f-hidden");
        }
      }

      resetCountdown() {
        clearInterval(this.intervalId);
        this.units.forEach((unit) => {
          if (this.elements[unit]) {
            this.elements[unit].textContent = "00";
          }
        });
      }

      getEvergreenDueDate() {
        let intervalHrs;
        const now = new Date();
        const dueDate = new Date(now);

        switch (this.duration) {
          case "every_month":
            dueDate.setMonth(dueDate.getMonth() + 1); // Next month.
            dueDate.setDate(1); // Start from the 1st day of the next month.
            dueDate.setHours(0, 0, 0, 0);
            return dueDate;
          case "every_week":
            const dayOfWeek = now.getDay();
            const daysUntilNextWeek = 7 - dayOfWeek;
            dueDate.setDate(now.getDate() + daysUntilNextWeek); // Move to next Sunday.
            dueDate.setHours(0, 0, 0, 0); // Set the time to 00:00:00.
            return dueDate;
          case "every_2_hrs":
            intervalHrs = 2;
            break;
          case "every_6_hrs":
            intervalHrs = 6;
            break;
          case "every_12_hrs":
            intervalHrs = 12;
            break;
          case "every_24_hrs":
            intervalHrs = 24;
            break;
        }

        const currentHour = now.getHours();

        // Possible start points based on the interval.
        const startPoints = [];
        for (let i = 0; i < 24; i += intervalHrs) {
          startPoints.push(i);
        }

        // Find the next start point.
        for (let i = 0; i < startPoints.length; i++) {
          if (
            currentHour < startPoints[i] ||
            (currentHour === startPoints[i] &&
              now.getMinutes() === 0 &&
              now.getSeconds() === 0)
          ) {
            dueDate.setHours(startPoints[i], 0, 0, 0);
            return dueDate;
          }
        }

        // If no future point today, roll over to the first point tomorrow.
        dueDate.setDate(dueDate.getDate() + 1);
        dueDate.setHours(startPoints[0], 0, 0, 0);
        return dueDate;
      }
    }
  );
}
