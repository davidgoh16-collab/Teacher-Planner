import { Colleague, WeeklyTimetable } from '../../types';

const createEntry = (subject: string, room: string = '', colorClass: string = 'bg-gray-100 text-gray-800') => ({
  subject,
  room,
  colorClass
});

const GEO_COLOR = 'bg-emerald-100 text-emerald-800';
const EPQ_COLOR = 'bg-purple-100 text-purple-800';
const MATH_COLOR = 'bg-blue-100 text-blue-800';
const SOC_COLOR = 'bg-yellow-100 text-yellow-800';
const DUTY_COLOR = 'bg-orange-100 text-orange-800'; // Canteen, Mentoring
const ADMIN_COLOR = 'bg-gray-200 text-gray-800'; // SLT, ER, Meetings
const PPA_COLOR = 'bg-green-50 text-green-800';

const POL_COLOR = 'bg-pink-100 text-pink-800';
const HIS_COLOR = 'bg-indigo-100 text-indigo-800';

export const INITIAL_COLLEAGUES: Omit<Colleague, 'id'>[] = [
  {
    name: "Miss A COCKS (ACO)",
    week1: {
      Monday: {
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // 3D
        "Period 4": createEntry("13/Pol", "D12", POL_COLOR),
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // 5C
        "Period 6": createEntry("9V/His", "D13", HIS_COLOR),
      },
      Tuesday: {
        "Period 2": createEntry("PPA", "N/A", PPA_COLOR),
        "Period 5": createEntry("13/Pol", "V19", POL_COLOR), // 5A, 5B, 5C
        "Period 6": createEntry("10C/His", "D12", HIS_COLOR),
      },
      Wednesday: {
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // 3D
        "Period 4": createEntry("10C/His", "D15", HIS_COLOR),
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // 5C
        "Period 6": createEntry("13/Pol", "V19", POL_COLOR),
      },
      Thursday: {
        "Period 2": createEntry("10C/His", "D15", HIS_COLOR),
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // 3D
        "Period 4": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // 5A
        "Period 6": createEntry("9V/His", "D13", HIS_COLOR),
      },
      Friday: {
        "Period 2": createEntry("13/Pol", "V19", POL_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // 3D
        "Period 4": createEntry("13/Pol", "V19", POL_COLOR),
        "Period 5": createEntry("10C/His", "D12", HIS_COLOR), // 5A, 5B, 5C
      }
    },
    week2: {
      Monday: {
        "Period 2": createEntry("13/Pol", "V19", POL_COLOR),
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // 3D
        "Period 4": createEntry("9V/His", "D13", HIS_COLOR),
        "Period 5": createEntry("Canteen Front", "N/A", DUTY_COLOR), // 5C
      },
      Tuesday: {
        "Period 2": createEntry("PPA", "N/A", PPA_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // 3 / Midday
        "Period 5": createEntry("Canteen Front", "N/A", DUTY_COLOR),
        "Period 6": createEntry("Meeting", "N/A", ADMIN_COLOR),
      },
      Wednesday: {
        "Period 2": createEntry("SLT Roaming", "N/A", ADMIN_COLOR),
        "Period 4": createEntry("10C/His", "D12", HIS_COLOR),
        "Period 5": createEntry("Canteen Front", "N/A", DUTY_COLOR), // 5C
        "Period 6": createEntry("13/Pol", "V19", POL_COLOR),
      },
      Thursday: {
        "Period 2": createEntry("10C/His", "D12", HIS_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR),
        "Period 6": createEntry("9V/His", "D15", HIS_COLOR),
      },
      Friday: {
        "Period 2": createEntry("13/Pol", "V19", POL_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR),
        "Period 5": createEntry("ER", "N/A", ADMIN_COLOR), // 5A, 5B, 5C
      }
    }
  },
  {
    name: "Mrs V FOX (VF)",
    week1: {
      Monday: {
        "Period 1": createEntry("13/50 (AM)", "", ADMIN_COLOR),
        "Period 2": createEntry("11A/Geo", "RM 5O", GEO_COLOR),
        "Period 3": createEntry("12/EPQ", "RM 5O", EPQ_COLOR), // P3A
        "Period 4": createEntry("13/Geo", "V22B", GEO_COLOR),
        "Period 5": createEntry("7S/Geo", "RM 5O", GEO_COLOR), // P5A
        "Period 6": createEntry("10C/Geo", "RM 5O", GEO_COLOR),
      },
      Tuesday: {
        "Period 1": createEntry("13/50 (AM)", "", ADMIN_COLOR),
        "Period 2": createEntry("9S/Geo", "RM 5O", GEO_COLOR),
        "Period 3": createEntry("12/EPQ", "RM 5O", EPQ_COLOR),
        "Period 4": null,
        "Period 5": createEntry("13/EPQ", "RM 5O", EPQ_COLOR),
        "Period 6": createEntry("13/Geo", "RM 5O", GEO_COLOR),
      },
      Wednesday: {
        "Period 1": createEntry("13/50 (AM)", "", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": null,
        "Period 4": createEntry("10C/Geo", "RM 5O", GEO_COLOR),
        "Period 5": createEntry("PPA", "N/A", PPA_COLOR),
        "Period 6": createEntry("13/Geo", "RM 5O", GEO_COLOR),
      },
      Thursday: {
        "Period 1": createEntry("13/50 (AM)", "", ADMIN_COLOR),
        "Period 2": createEntry("10C/Geo", "RM 5O", GEO_COLOR),
        "Period 3": createEntry("9S/Geo", "RM 5O", GEO_COLOR), // P3B
        "Period 4": createEntry("11A/Geo", "RM 5O", GEO_COLOR),
        "Period 5": createEntry("PPA", "N/A", PPA_COLOR),
        "Period 6": createEntry("12/EPQ", "RM 5O", EPQ_COLOR),
      },
      Friday: {
        "Period 1": createEntry("13/50 (AM)", "", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": createEntry("9M/Geo", "RM 5O", GEO_COLOR), // P3B
        "Period 4": createEntry("13/Geo", "RM 5O", GEO_COLOR),
        "Period 5": createEntry("10C/Geo", "RM 5O", GEO_COLOR), // P5A
        "Period 6": createEntry("11A/Geo", "RM 5O", GEO_COLOR),
      }
    },
    week2: {
      Monday: {
        "Period 1": createEntry("13/50 (AM)", "", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": createEntry("13/EPQ", "RM 5O", EPQ_COLOR), // P3A
        "Period 4": createEntry("Meeting", "N/A", ADMIN_COLOR),
        "Period 5": createEntry("11A/Geo", "RM 5O", GEO_COLOR), // P5A
        "Period 6": createEntry("11A/Geo", "RM 5O", GEO_COLOR),
      },
      Tuesday: {
        "Period 1": createEntry("13/50 (AM)", "", ADMIN_COLOR),
        "Period 2": createEntry("9M/Geo", "RM 5O", GEO_COLOR),
        "Period 3": createEntry("13/EPQ", "RM 5O", EPQ_COLOR),
        "Period 4": createEntry("PPA", "N/A", PPA_COLOR),
        "Period 5": createEntry("11A/Geo", "RM 5O", GEO_COLOR),
        "Period 6": createEntry("9S/Geo", "RM 5O", GEO_COLOR),
      },
      Wednesday: {
        "Period 1": createEntry("13/50 (AM)", "", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": null,
        "Period 4": null,
        "Period 5": createEntry("10C/Geo", "RM 5O", GEO_COLOR),
        "Period 6": createEntry("13/Geo", "RM 5O", GEO_COLOR),
      },
      Thursday: {
        "Period 1": createEntry("13/50 (AM)", "", ADMIN_COLOR),
        "Period 2": createEntry("10C/Geo", "RM 5O", GEO_COLOR),
        "Period 3": null,
        "Period 4": null,
        "Period 5": createEntry("12/EPQ", "RM 5O", EPQ_COLOR),
        "Period 6": createEntry("9M/Geo", "RM 5O", GEO_COLOR),
      },
      Friday: {
        "Period 1": createEntry("13/50 (AM)", "", ADMIN_COLOR),
        "Period 2": createEntry("13/EPQ", "RM 5O", EPQ_COLOR),
        "Period 3": createEntry("11A/Geo", "RM 5O", GEO_COLOR),
        "Period 4": createEntry("PPA", "N/A", PPA_COLOR),
        "Period 5": createEntry("9M/Geo", "RM 5O", GEO_COLOR), // P5B
        "Period 6": createEntry("9S/Geo", "RM 5O", GEO_COLOR),
      }
    }
  },
  {
    name: "Mr S CHRISTOPHER (SCH)",
    week1: {
      Monday: {
        "Period 1": null,
        "Period 2": createEntry("Meeting", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3D
        "Period 4": null,
        "Period 5": createEntry("7X/Mat3", "EP14", MATH_COLOR), // P5A
        "Period 6": createEntry("ER", "N/A", ADMIN_COLOR),
      },
      Tuesday: {
        "Period 1": null,
        "Period 2": null,
        "Period 3": createEntry("ER", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5B
        "Period 6": createEntry("ER", "N/A", ADMIN_COLOR),
      },
      Wednesday: {
        "Period 1": null,
        "Period 2": createEntry("SLT Roaming", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3D
        "Period 4": null,
        "Period 5": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P5B
        "Period 6": createEntry("ER", "N/A", ADMIN_COLOR),
      },
      Thursday: {
        "Period 1": null,
        "Period 2": null,
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3B
        "Period 4": null,
        "Period 5": createEntry("7X/Mat3", "EP14", MATH_COLOR), // P5A
        "Period 6": createEntry("ER", "N/A", ADMIN_COLOR),
      },
      Friday: {
        "Period 1": null,
        "Period 2": null,
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3B
        "Period 4": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5B
        "Period 6": null,
      }
    },
    week2: {
      Monday: {
        "Period 1": null,
        "Period 2": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3B
        "Period 4": createEntry("7X/Mat3", "EP14", MATH_COLOR),
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5C
        "Period 6": createEntry("8Y/Mat1", "EP1", MATH_COLOR),
      },
      Tuesday: {
        "Period 1": null,
        "Period 2": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3B
        "Period 4": null,
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5C
        "Period 6": null,
      },
      Wednesday: {
        "Period 1": null,
        "Period 2": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3B
        "Period 4": createEntry("8Y/Mat1", "EP1", MATH_COLOR),
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5C
        "Period 6": createEntry("7X/Mat3", "EP14", MATH_COLOR),
      },
      Thursday: {
        "Period 1": null,
        "Period 2": createEntry("7X/Mat3", "EP14", MATH_COLOR),
        "Period 3": createEntry("ER", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P5C
        "Period 6": createEntry("ER", "N/A", ADMIN_COLOR),
      },
      Friday: {
        "Period 1": null,
        "Period 2": createEntry("SLT Roaming", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3B
        "Period 4": createEntry("7X/Mat3", "EP14", MATH_COLOR),
        "Period 5": createEntry("7H/DT", "V20", MATH_COLOR), // P5A
        "Period 6": createEntry("ER", "N/A", ADMIN_COLOR),
      }
    }
  },
  {
    name: "Mrs L SMITH (LSM)",
    week1: {
      Monday: {
        "Period 1": null,
        "Period 2": createEntry("SLT Roaming", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P3B
        "Period 4": null,
        "Period 5": createEntry("ER", "N/A", ADMIN_COLOR), // P5A
        "Period 6": null,
      },
      Tuesday: {
        "Period 1": null,
        "Period 2": null,
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3B
        "Period 4": null,
        "Period 5": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P5A
        "Period 6": createEntry("7W/Geo", "C15", SOC_COLOR),
      },
      Wednesday: {
        "Period 1": null,
        "Period 2": null,
        "Period 3": createEntry("ER", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("13/Soc", "V21A", SOC_COLOR), // P5A
        "Period 6": createEntry("Mentoring", "N/A", DUTY_COLOR),
      },
      Thursday: {
        "Period 1": null,
        "Period 2": null,
        "Period 3": createEntry("13/Soc", "V21A", SOC_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("7W/Geo", "C15", SOC_COLOR), // P5A
        "Period 6": null,
      },
      Friday: {
        "Period 1": null,
        "Period 2": createEntry("PPA", "N/A", PPA_COLOR),
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("ER", "N/A", ADMIN_COLOR), // P5A
        "Period 6": createEntry("Mentoring", "N/A", DUTY_COLOR),
      }
    },
    week2: {
      Monday: {
        "Period 1": null,
        "Period 2": null,
        "Period 3": createEntry("ER", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5B
        "Period 6": null,
      },
      Tuesday: {
        "Period 1": null,
        "Period 2": createEntry("SLT Roaming", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5B
        "Period 6": null,
      },
      Wednesday: {
        "Period 1": null,
        "Period 2": createEntry("7W/Geo", "C15", SOC_COLOR),
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("ER", "N/A", ADMIN_COLOR), // P5B
        "Period 6": createEntry("Mentoring", "N/A", DUTY_COLOR),
      },
      Thursday: {
        "Period 1": null,
        "Period 2": null,
        "Period 3": createEntry("13/Soc", "V21A", SOC_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("7W/Geo", "C15", SOC_COLOR), // P5A
        "Period 6": createEntry("13/Soc", "V21A", SOC_COLOR),
      },
      Friday: {
        "Period 1": null,
        "Period 2": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P3A
        "Period 4": createEntry("13/Soc", "V21A", SOC_COLOR),
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5C
        "Period 6": createEntry("Mentoring", "N/A", DUTY_COLOR),
      }
    }
  },
  {
    name: "Mrs C LIMA (CL)",
    week1: {
      Monday: {
        "Morning Mtg": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 1": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 2": createEntry("Mentoring", "N/A", DUTY_COLOR),
        "Period 3": createEntry("12/HSC3", "C14", SOC_COLOR),
        "Period 4": createEntry("8V/PSHE", "C14", SOC_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 1": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 2": createEntry("7A/PSHE", "C14", SOC_COLOR),
        "Period 3": createEntry("12/HSC3", "C14", SOC_COLOR),
        "Period 4": createEntry("PPA", "N/A", PPA_COLOR),
      },
      Wednesday: {
        "Morning Mtg": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 1": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": null,
        "Period 4": createEntry("WTF", "N/A", ADMIN_COLOR),
      },
      Thursday: {
        "Morning Mtg": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 1": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 2": createEntry("7W/PSHE", "C15", SOC_COLOR),
        "Period 3": createEntry("WTF", "N/A", ADMIN_COLOR),
        "Period 4": createEntry("9H/PSHE", "BE1", SOC_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 1": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": null,
        "Period 4": createEntry("10X/PSHE1", "C14", SOC_COLOR),
      }
    },
    week2: {
      Monday: {
        "Morning Mtg": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 1": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 2": createEntry("10Y/PSHE3", "C14", SOC_COLOR),
        "Period 3": createEntry("WTF", "N/A", ADMIN_COLOR),
        "Period 4": createEntry("Mentoring", "N/A", DUTY_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 1": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": createEntry("7S/PSHE", "EV1", SOC_COLOR),
        "Period 4": createEntry("PPA", "N/A", PPA_COLOR),
      },
      Wednesday: {
        "Morning Mtg": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 1": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 2": createEntry("12/HSC3", "C14", SOC_COLOR),
        "Period 3": null,
        "Period 4": null,
      },
      Thursday: {
        "Morning Mtg": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 1": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 2": createEntry("WTF", "N/A", ADMIN_COLOR),
        "Period 3": null,
        "Period 4": createEntry("WTF", "N/A", ADMIN_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 1": createEntry("10X", "D1", ADMIN_COLOR),
        "Period 2": createEntry("WTF", "N/A", ADMIN_COLOR),
        "Period 3": null,
        "Period 4": createEntry("9H/PSHE", "C14", SOC_COLOR),
      }
    }
  },
  {
    name: "Mr D WISEMAN (WDA)",
    week1: {
      Monday: {
        "Period 1": null,
        "Period 2": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P5A
        "Period 6": createEntry("WTF", "N/A", ADMIN_COLOR),
      },
      Tuesday: {
        "Period 1": null,
        "Period 2": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5A
        "Period 6": null,
      },
      Wednesday: {
        "Period 1": null,
        "Period 2": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 3": null,
        "Period 4": null,
        "Period 5": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P5A
        "Period 6": createEntry("ER", "N/A", ADMIN_COLOR),
      },
      Thursday: {
        "Period 1": null,
        "Period 2": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("ER", "N/A", ADMIN_COLOR), // P5A
        "Period 6": null,
      },
      Friday: {
        "Period 1": null,
        "Period 2": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5A
        "Period 6": null,
      }
    },
    week2: {
      Monday: {
        "Period 1": null,
        "Period 2": null,
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P5A
        "Period 6": createEntry("ER", "N/A", ADMIN_COLOR),
      },
      Tuesday: {
        "Period 1": null,
        "Period 2": null,
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("7Y2/Mat1", "EP11", MATH_COLOR), // P5A
        "Period 6": createEntry("ER", "N/A", ADMIN_COLOR),
      },
      Wednesday: {
        "Period 1": null,
        "Period 2": createEntry("9X/Mat3", "EP11", MATH_COLOR),
        "Period 3": createEntry("ER", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": null,
        "Period 6": createEntry("ER", "N/A", ADMIN_COLOR),
      },
      Thursday: {
        "Period 1": null,
        "Period 2": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5A
        "Period 6": createEntry("7Y2/Mat1", "EP11", MATH_COLOR),
      },
      Friday: {
        "Period 1": null,
        "Period 2": createEntry("9X/Mat3", "EP11", MATH_COLOR),
        "Period 3": createEntry("ER", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": null,
        "Period 6": null,
      }
    }
  },
  {
    name: "Mrs D OKAGBARE (DOK)",
    week1: {
      Monday: {
        "Period 1": null,
        "Period 2": createEntry("8X/Mat3", "EP14", MATH_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3A
        "Period 4": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5A
        "Period 6": null,
      },
      Tuesday: {
        "Period 1": null,
        "Period 2": null,
        "Period 3": createEntry("ER", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("ER", "N/A", ADMIN_COLOR), // P5A
        "Period 6": null,
      },
      Wednesday: {
        "Period 1": null,
        "Period 2": createEntry("12/Acc", "V19", EPQ_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3A
        "Period 4": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5A
        "Period 6": createEntry("9X/Mat1", "EP14", MATH_COLOR),
      },
      Thursday: {
        "Period 1": null,
        "Period 2": createEntry("PPA", "N/A", PPA_COLOR),
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P3A
        "Period 4": createEntry("12/Acc", "V19", EPQ_COLOR),
        "Period 5": createEntry("12/Acc", "V19", EPQ_COLOR), // P5A
        "Period 6": null,
      },
      Friday: {
        "Period 1": null,
        "Period 2": createEntry("Mentoring", "N/A", DUTY_COLOR),
        "Period 3": createEntry("12/Acc", "V19", EPQ_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P5A
        "Period 6": null,
      }
    },
    week2: {
      Monday: {
        "Period 1": null,
        "Period 2": createEntry("8X/Mat3", "EP14", MATH_COLOR),
        "Period 3": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5A
        "Period 6": createEntry("12/Acc", "V19", EPQ_COLOR),
      },
      Tuesday: {
        "Period 1": null,
        "Period 2": null,
        "Period 3": createEntry("ER", "N/A", ADMIN_COLOR), // P3A
        "Period 4": null,
        "Period 5": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P5A
        "Period 6": createEntry("12/Acc", "V19", EPQ_COLOR),
      },
      Wednesday: {
        "Period 1": null,
        "Period 2": createEntry("9X/Mat1", "EP14", MATH_COLOR),
        "Period 3": null,
        "Period 4": createEntry("ER", "N/A", ADMIN_COLOR),
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5A
        "Period 6": createEntry("12/Acc", "V21A", EPQ_COLOR),
      },
      Thursday: {
        "Period 1": null,
        "Period 2": createEntry("PPA", "N/A", PPA_COLOR),
        "Period 3": null,
        "Period 4": null,
        "Period 5": createEntry("Canteen Front", "N/A", DUTY_COLOR), // P5A
        "Period 6": createEntry("12/Acc", "V19", EPQ_COLOR),
      },
      Friday: {
        "Period 1": null,
        "Period 2": createEntry("9X/Mat1", "EP14", MATH_COLOR),
        "Period 3": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P3A
        "Period 4": createEntry("12/Acc", "V19", EPQ_COLOR),
        "Period 5": createEntry("SLT Roaming", "N/A", ADMIN_COLOR), // P5A
        "Period 6": null,
      }
    }
  }
];
