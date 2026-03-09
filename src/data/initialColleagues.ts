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

const ENG_COLOR = 'bg-sky-100 text-sky-800';
const HSC_COLOR = 'bg-rose-100 text-rose-800';
const CRIM_COLOR = 'bg-fuchsia-100 text-fuchsia-800';
const PSHE_COLOR = 'bg-teal-100 text-teal-800';
const PE_COLOR = 'bg-cyan-100 text-cyan-800';
const DT_COLOR = 'bg-amber-100 text-amber-800';
const CON_COLOR = 'bg-stone-200 text-stone-800';
const ETH_COLOR = 'bg-violet-100 text-violet-800';
const SP_COLOR = 'bg-red-100 text-red-800';

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
  },
  {
    name: "Mrs C GRANT-NEMBHARD (CGN)",
    week1: {
      Monday: {
        "Morning Mtg": createEntry("11T", "EV13", ADMIN_COLOR),
        "Period 1": createEntry("11T", "EV13", ADMIN_COLOR),
        "Period 2": createEntry("Meeting", "", ADMIN_COLOR),
        "Period 3": createEntry("11Y/Mat1", "EP13", MATH_COLOR),
        "Period 4": createEntry("10X/Mat1", "EP13", MATH_COLOR),
        "Period 5": createEntry("11X/Mat3", "EP13", MATH_COLOR),
        "Period 6": createEntry("10Y/Mat", "EP13", MATH_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("IT", "EV13", ADMIN_COLOR),
        "Period 1": createEntry("11T", "EV13", ADMIN_COLOR),
        "Period 2": createEntry("10X/Mat1", "EP13", MATH_COLOR),
        "Period 3": null,
        "Period 4": createEntry("10Y/Mat1", "EP13", MATH_COLOR),
        "Period 5": createEntry("Meeting", "", ADMIN_COLOR),
        "Period 6": createEntry("HY/Mat1", "EP13", MATH_COLOR),
      },
      Wednesday: {
        "Morning Mtg": createEntry("11T", "EV13", ADMIN_COLOR),
        "Period 1": createEntry("11T", "EV13", ADMIN_COLOR),
        "Period 2": createEntry("11X/Mat3", "EP13", MATH_COLOR),
        "Period 3": createEntry("PPA", "", PPA_COLOR),
        "Period 4": createEntry("11Y/Mat", "EP13", MATH_COLOR),
        "Period 5": createEntry("10X/Mat1", "EP13", MATH_COLOR),
        "Period 6": null,
      },
      Thursday: {
        "Morning Mtg": createEntry("IIT", "EV13", ADMIN_COLOR),
        "Period 1": createEntry("IIT", "EV13", ADMIN_COLOR),
        "Period 2": createEntry("11Y/Mat1", "EP13", MATH_COLOR),
        "Period 3": createEntry("10X/Mat1", "EP13", MATH_COLOR),
        "Period 4": null,
        "Period 5": createEntry("11X/Mat3", "EP13", MATH_COLOR),
        "Period 6": createEntry("10Y/Mat", "EP13", MATH_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("HT", "EV13", ADMIN_COLOR),
        "Period 1": createEntry("IIT", "EV13", ADMIN_COLOR),
        "Period 2": createEntry("10X/Mat1", "EP13", MATH_COLOR),
        "Period 3": createEntry("11X/Mat3", "EP13", MATH_COLOR),
        "Period 4": null,
        "Period 5": createEntry("HY/Mat1", "EP13", MATH_COLOR),
        "Period 6": createEntry("10Y/Mat", "EP13", MATH_COLOR),
      },
    },
    week2: {
      Monday: {
        "Morning Mtg": createEntry("11T", "EV13", ADMIN_COLOR),
        "Period 1": createEntry("11T", "EV13", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": createEntry("10X/Mat1", "EP13", MATH_COLOR),
        "Period 4": createEntry("10Y/Mat1", "EP13", MATH_COLOR),
        "Period 5": createEntry("11Y/Mat1", "EP13", MATH_COLOR),
        "Period 6": createEntry("PPA", "", PPA_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("HT", "EV13", ADMIN_COLOR),
        "Period 1": createEntry("IIT", "EV13", ADMIN_COLOR),
        "Period 2": createEntry("10Y/Mat1", "EP13", MATH_COLOR),
        "Period 3": createEntry("10X/Mat1", "EP13", MATH_COLOR),
        "Period 4": createEntry("11X/Mat3", "EP13", MATH_COLOR),
        "Period 5": createEntry("PPA", "", PPA_COLOR),
        "Period 6": null,
      },
      Wednesday: {
        "Morning Mtg": createEntry("11T", "EV13", ADMIN_COLOR),
        "Period 1": createEntry("11T", "EV13", ADMIN_COLOR),
        "Period 2": createEntry("7Y1/Mat2", "EP13", MATH_COLOR),
        "Period 3": createEntry("11Y/Mat1", "EP13", MATH_COLOR),
        "Period 4": null,
        "Period 5": createEntry("11X/Mat3", "EP13", MATH_COLOR),
        "Period 6": null,
      },
      Thursday: {
        "Morning Mtg": createEntry("11T", "EV13", ADMIN_COLOR),
        "Period 1": createEntry("IIT", "EV13", ADMIN_COLOR),
        "Period 2": createEntry("11X/Mat3", "EP13", MATH_COLOR),
        "Period 3": null,
        "Period 4": createEntry("10Y/Mat1", "EP13", MATH_COLOR),
        "Period 5": createEntry("Meeting", "", ADMIN_COLOR),
        "Period 6": createEntry("11Y/Mat1", "EP13", MATH_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("UT", "EV13", ADMIN_COLOR),
        "Period 1": createEntry("1IT", "EV13", ADMIN_COLOR),
        "Period 2": createEntry("7Y1/Mat2", "EP13", MATH_COLOR),
        "Period 3": createEntry("PPA", "", PPA_COLOR),
        "Period 4": createEntry("11X/Mat3", "EP13", MATH_COLOR),
        "Period 5": createEntry("10X/Mat1", "EP13", MATH_COLOR),
        "Period 6": createEntry("10Y/Mat1", "EP13", MATH_COLOR),
      },
    },
  },
  {
    name: "Miss S DRAPER (SD)",
    week1: {
      Monday: {
        "Morning Mtg": null,
        "Period 1": null,
        "Period 2": null,
        "Period 3": null,
        "Period 4": createEntry("12/Soc", "D16", SOC_COLOR),
        "Period 5": createEntry("12/HSC2", "D16", HSC_COLOR),
        "Period 6": null,
      },
      Tuesday: {
        "Morning Mtg": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 1": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 2": createEntry("PPA", "", PPA_COLOR),
        "Period 3": createEntry("13/Soc", "D16", SOC_COLOR),
        "Period 4": createEntry("12/Soc", "D16", SOC_COLOR),
        "Period 5": createEntry("12/HSC2", "D16", HSC_COLOR),
        "Period 6": createEntry("13/Crim", "D16", CRIM_COLOR),
      },
      Wednesday: {
        "Morning Mtg": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 1": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 2": createEntry("10B/Soc", "D16", SOC_COLOR),
        "Period 3": createEntry("12/Soc", "D16", SOC_COLOR),
        "Period 4": createEntry("13/Crim", "D16", CRIM_COLOR),
        "Period 5": createEntry("12/HSC2", "D16", HSC_COLOR),
        "Period 6": createEntry("PPA", "", PPA_COLOR),
      },
      Thursday: {
        "Morning Mtg": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 1": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 2": createEntry("13/Crim", "D16", CRIM_COLOR),
        "Period 3": createEntry("12/HSC2", "D16", HSC_COLOR),
        "Period 4": createEntry("11A/Soc", "D16", SOC_COLOR),
        "Period 5": createEntry("10B/Soc", "D16", SOC_COLOR),
        "Period 6": createEntry("PPA", "", PPA_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 1": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 2": createEntry("12/Soc", "D16", SOC_COLOR),
        "Period 3": createEntry("10B/Soc", "D16", SOC_COLOR),
        "Period 4": createEntry("12/HSC2", "D16", HSC_COLOR),
        "Period 5": createEntry("13/Crim", "D16", CRIM_COLOR),
        "Period 6": createEntry("11A/Soc", "D16", SOC_COLOR),
      },
    },
    week2: {
      Monday: {
        "Morning Mtg": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 1": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 2": createEntry("12/Soc", "D16", SOC_COLOR),
        "Period 3": createEntry("12/HSC2", "D16", HSC_COLOR),
        "Period 4": createEntry("13/Crim", "D16", CRIM_COLOR),
        "Period 5": createEntry("13/Soc", "D16", SOC_COLOR),
        "Period 6": createEntry("11A/Soc", "D16", SOC_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 1": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 2": createEntry("13/Crim", "D16", CRIM_COLOR),
        "Period 3": createEntry("12/HSC2", "D16", HSC_COLOR),
        "Period 4": createEntry("12/Soc", "D16", SOC_COLOR),
        "Period 5": createEntry("11A/Soc", "D16", SOC_COLOR),
        "Period 6": createEntry("Meeting", "", ADMIN_COLOR),
      },
      Wednesday: {
        "Morning Mtg": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 1": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 2": createEntry("13/Soc", "D16", SOC_COLOR),
        "Period 3": createEntry("13/Crim", "D16", CRIM_COLOR),
        "Period 4": createEntry("12/Soc", "D16", SOC_COLOR),
        "Period 5": createEntry("PPA", "", PPA_COLOR),
        "Period 6": createEntry("10B/Soc", "D16", SOC_COLOR),
      },
      Thursday: {
        "Morning Mtg": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 1": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 2": createEntry("PPA", "", PPA_COLOR),
        "Period 3": createEntry("12/HSC2", "D16", HSC_COLOR),
        "Period 4": createEntry("12/Soc", "D16", SOC_COLOR),
        "Period 5": createEntry("13/Crim", "D16", CRIM_COLOR),
        "Period 6": createEntry("10B/Soc", "D16", SOC_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 1": createEntry("9H", "V23", ADMIN_COLOR),
        "Period 2": createEntry("PPA", "", PPA_COLOR),
        "Period 3": createEntry("11A/Soc", "D16", SOC_COLOR),
        "Period 4": createEntry("10B/Soc", "D16", SOC_COLOR),
        "Period 5": createEntry("12/HSC2", "D16", HSC_COLOR),
        "Period 6": createEntry("12/Soc", "D16", SOC_COLOR),
      },
    },
  },
  {
    name: "Miss S JONES (SJ)",
    week1: {
      Monday: {
        "Morning Mtg": null,
        "Period 1": null,
        "Period 2": createEntry("Cover", "", ADMIN_COLOR),
        "Period 3": createEntry("10A/Soc", "C16", SOC_COLOR),
        "Period 4": createEntry("PPA", "", PPA_COLOR),
        "Period 5": null,
        "Period 6": null,
      },
      Tuesday: {
        "Morning Mtg": createEntry("SH", "LIB", ADMIN_COLOR),
        "Period 1": createEntry("8H", "LIB", ADMIN_COLOR),
        "Period 2": createEntry("12/PSHEI", "D15", PSHE_COLOR),
        "Period 3": createEntry("10A/Soc €16", "", SOC_COLOR),
        "Period 4": createEntry("IIB/Soc", "C16", SOC_COLOR),
        "Period 5": createEntry("12/Crim", "C16", CRIM_COLOR),
        "Period 6": createEntry("Cover", "", ADMIN_COLOR),
      },
      Wednesday: {
        "Morning Mtg": createEntry("8H LIB", "", ADMIN_COLOR),
        "Period 1": createEntry("8H LIB", "", ADMIN_COLOR),
        "Period 2": createEntry("9M/PSHE", "D15", PSHE_COLOR),
        "Period 3": createEntry("11B/Soc 16", "", SOC_COLOR),
        "Period 4": createEntry("PPA", "", PPA_COLOR),
        "Period 5": createEntry("12/Crim", "C16", CRIM_COLOR),
        "Period 6": createEntry("10A/Soc", "C16", SOC_COLOR),
      },
      Thursday: {
        "Morning Mtg": createEntry("SH", "LIB", ADMIN_COLOR),
        "Period 1": createEntry("8H", "LIB", ADMIN_COLOR),
        "Period 2": createEntry("71/PSHE", "EV2", PSHE_COLOR),
        "Period 3": createEntry("12/Crim", "C16", CRIM_COLOR),
        "Period 4": createEntry("Cover", "", ADMIN_COLOR),
        "Period 5": null,
        "Period 6": createEntry("13/PSHEI", "C16", PSHE_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("SH", "LIB", ADMIN_COLOR),
        "Period 1": createEntry("8H LIB", "", ADMIN_COLOR),
        "Period 2": createEntry("HB/Soc", "C16", SOC_COLOR),
        "Period 3": createEntry("PPA", "", PPA_COLOR),
        "Period 4": createEntry("12/Crim", "C16", CRIM_COLOR),
        "Period 5": createEntry("8S/Eth", "D15", ETH_COLOR),
        "Period 6": createEntry("Cover", "", ADMIN_COLOR),
      },
    },
    week2: {
      Monday: {
        "Morning Mtg": createEntry("8H", "LIB", ADMIN_COLOR),
        "Period 1": createEntry("8H", "LIB", ADMIN_COLOR),
        "Period 2": createEntry("10Y/PSHEI", "DIS", PSHE_COLOR),
        "Period 3": createEntry("12/Crim", "C16", CRIM_COLOR),
        "Period 4": createEntry("9E/Geo RM 44", "", GEO_COLOR),
        "Period 5": createEntry("10A/Soc", "C16", SOC_COLOR),
        "Period 6": createEntry("Cover", "", ADMIN_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("8H", "LIB", ADMIN_COLOR),
        "Period 1": createEntry("8H", "LIB", ADMIN_COLOR),
        "Period 2": createEntry("Cover", "", ADMIN_COLOR),
        "Period 3": createEntry("12/Crim", "C16", CRIM_COLOR),
        "Period 4": createEntry("10A/Soc", "C16", SOC_COLOR),
        "Period 5": createEntry("PPA", "", PPA_COLOR),
        "Period 6": createEntry("13/PSHE1", "C16", PSHE_COLOR),
      },
      Wednesday: {
        "Morning Mtg": createEntry("8H LIB", "", ADMIN_COLOR),
        "Period 1": createEntry("8H", "LIB", ADMIN_COLOR),
        "Period 2": createEntry("10A/Soc", "C16", SOC_COLOR),
        "Period 3": createEntry("9M/PSHE", "D15", PSHE_COLOR),
        "Period 4": createEntry("11B/Soc", "C16", SOC_COLOR),
        "Period 5": createEntry("12/PSHE1", "D15", PSHE_COLOR),
        "Period 6": createEntry("7T/PSHE", "D15", PSHE_COLOR),
      },
      Thursday: {
        "Morning Mtg": createEntry("SH", "LIB", ADMIN_COLOR),
        "Period 1": createEntry("8H", "LIB", ADMIN_COLOR),
        "Period 2": createEntry("Cover", "", ADMIN_COLOR),
        "Period 3": createEntry("12/Crim", "C16", CRIM_COLOR),
        "Period 4": createEntry("8S/Eth", "D15", ETH_COLOR),
        "Period 5": createEntry("11B/Soc", "C16", SOC_COLOR),
        "Period 6": createEntry("PPA", "", PPA_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("8H", "LIB", ADMIN_COLOR),
        "Period 1": createEntry("SH LIB", "", ADMIN_COLOR),
        "Period 2": createEntry("10X/Eth2", "D15", ETH_COLOR),
        "Period 3": createEntry("10Y/Eth2", "D15", ETH_COLOR),
        "Period 4": createEntry("Cover", "", ADMIN_COLOR),
        "Period 5": createEntry("12/Crim", "C16", CRIM_COLOR),
        "Period 6": createEntry("11B/Soc", "C16", SOC_COLOR),
      },
    },
  },
  {
    name: "Miss J SCOTT (JS)",
    week1: {
      Monday: {
        "Morning Mtg": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 1": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 2": createEntry("Mentoring", "", DUTY_COLOR),
        "Period 3": createEntry("9T/IT", "DI1", ADMIN_COLOR),
        "Period 4": createEntry("11X/PE3", "DEFAULT", PE_COLOR),
        "Period 5": createEntry("13/HSC3", "C14", HSC_COLOR),
        "Period 6": createEntry("11Y/PE3", "DEFAULT", PE_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 1": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 2": createEntry("11C/Sp", "V23", SP_COLOR),
        "Period 3": null,
        "Period 4": createEntry("13/HSC3", "C14", HSC_COLOR),
        "Period 5": null,
        "Period 6": createEntry("7M/PE", "DEFAULT", PE_COLOR),
      },
      Wednesday: {
        "Morning Mtg": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 1": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 2": createEntry("10B/Sp", "V23", SP_COLOR),
        "Period 3": createEntry("13/HSC3", "C14", HSC_COLOR),
        "Period 4": createEntry("PPA", "", PPA_COLOR),
        "Period 5": createEntry("7M/PE", "DEFAULT", PE_COLOR),
        "Period 6": createEntry("11Y/PE3", "DEFAULT", PE_COLOR),
      },
      Thursday: {
        "Morning Mtg": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 1": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 2": createEntry("9TAT/", "DII", ADMIN_COLOR),
        "Period 3": createEntry("11C/Sp", "V23", SP_COLOR),
        "Period 4": createEntry("13/HSC3", "C14", HSC_COLOR),
        "Period 5": createEntry("10B/Sp", "V23", SP_COLOR),
        "Period 6": createEntry("10X/PE3", "DEFAULT", PE_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 1": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 2": createEntry("10Y/PE3", "DEFAULT", PE_COLOR),
        "Period 3": createEntry("10B/Sp", "V23", SP_COLOR),
        "Period 4": createEntry("11C/Sp", "V23", SP_COLOR),
        "Period 5": createEntry("PPA", "", PPA_COLOR),
        "Period 6": createEntry("13/HSC3", "C14", HSC_COLOR),
      },
    },
    week2: {
      Monday: {
        "Morning Mtg": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 1": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 2": createEntry("Intervention", "", ADMIN_COLOR),
        "Period 3": createEntry("7M/PE DEFAULT", "", PE_COLOR),
        "Period 4": createEntry("11X/PE3 DEFAULT", "", PE_COLOR),
        "Period 5": null,
        "Period 6": createEntry("13/HSC3", "C14", HSC_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 1": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 2": createEntry("10X/PE3", "DEFAULT", PE_COLOR),
        "Period 3": createEntry("Mentoring", "", DUTY_COLOR),
        "Period 4": createEntry("Intervention", "", ADMIN_COLOR),
        "Period 5": null,
        "Period 6": createEntry("11C/Sp", "V23", SP_COLOR),
      },
      Wednesday: {
        "Morning Mtg": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 1": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 2": createEntry("13/HSC3", "C14", HSC_COLOR),
        "Period 3": createEntry("10Y/PE3", "DEFAULT", PE_COLOR),
        "Period 4": createEntry("13/HSC3", "C14", HSC_COLOR),
        "Period 5": createEntry("PPA", "", PPA_COLOR),
        "Period 6": createEntry("10B/Sp", "V23", SP_COLOR),
      },
      Thursday: {
        "Morning Mtg": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 1": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 2": createEntry("Intervention", "", ADMIN_COLOR),
        "Period 3": createEntry("13/HSC3", "C14", HSC_COLOR),
        "Period 4": createEntry("11X/PE3", "DEFAULT", PE_COLOR),
        "Period 5": createEntry("11C/Sp", "V23", SP_COLOR),
        "Period 6": createEntry("10B/Sp", "V23", SP_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 1": createEntry("10E", "D12", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": createEntry("13/HSC3", "C14", HSC_COLOR),
        "Period 4": createEntry("10B/Sp", "V23", SP_COLOR),
        "Period 5": null,
        "Period 6": createEntry("PPA", "", PPA_COLOR),
      },
    },
  },
  {
    name: "Miss M LONG (ML)",
    week1: {
      Monday: {
        "Morning Mtg": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 1": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 2": createEntry("11A/His", "D13", HIS_COLOR),
        "Period 3": createEntry("13/His", "D13", HIS_COLOR),
        "Period 4": createEntry("12His/", "D13", HIS_COLOR),
        "Period 5": createEntry("Meeting", "", ADMIN_COLOR),
        "Period 6": createEntry("Meeting", "", ADMIN_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("HE", "EV3", ADMIN_COLOR),
        "Period 1": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 2": createEntry("8S/His", "D13", HIS_COLOR),
        "Period 3": null,
        "Period 4": createEntry("9T/Eth", "D13", ETH_COLOR),
        "Period 5": null,
        "Period 6": createEntry("7H/His", "D13", HIS_COLOR),
      },
      Wednesday: {
        "Morning Mtg": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 1": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 2": createEntry("10B/His", "D13", HIS_COLOR),
        "Period 3": createEntry("PPA", "", PPA_COLOR),
        "Period 4": createEntry("7HHis/", "D13", HIS_COLOR),
        "Period 5": createEntry("13/His", "D13", HIS_COLOR),
        "Period 6": null,
      },
      Thursday: {
        "Morning Mtg": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 1": createEntry("IE", "EV3", ADMIN_COLOR),
        "Period 2": createEntry("7HHis/", "D13", HIS_COLOR),
        "Period 3": createEntry("8S/His", "D13", HIS_COLOR),
        "Period 4": createEntry("11A/His", "D13", HIS_COLOR),
        "Period 5": createEntry("10B/His", "D13", HIS_COLOR),
        "Period 6": createEntry("PPA", "", PPA_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("HE", "EV3", ADMIN_COLOR),
        "Period 1": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 2": createEntry("12/His", "D13", HIS_COLOR),
        "Period 3": createEntry("10B/His", "D13", HIS_COLOR),
        "Period 4": createEntry("7TEth/", "D13", ETH_COLOR),
        "Period 5": null,
        "Period 6": createEntry("11A/His", "D13", HIS_COLOR),
      },
    },
    week2: {
      Monday: {
        "Morning Mtg": createEntry("1HE", "EV3", ADMIN_COLOR),
        "Period 1": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": createEntry("9T/Eth", "D13", ETH_COLOR),
        "Period 4": createEntry("13/His", "D13", HIS_COLOR),
        "Period 5": createEntry("11A/His", "D13", HIS_COLOR),
        "Period 6": null,
      },
      Tuesday: {
        "Morning Mtg": createEntry("HE", "EV3", ADMIN_COLOR),
        "Period 1": createEntry("", "EV3", ADMIN_COLOR),
        "Period 2": createEntry("PPA", "", PPA_COLOR),
        "Period 3": createEntry("7H/His", "D13", HIS_COLOR),
        "Period 4": createEntry("12His/", "D13", HIS_COLOR),
        "Period 5": createEntry("11A/His", "D13", HIS_COLOR),
        "Period 6": null,
      },
      Wednesday: {
        "Morning Mtg": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 1": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 2": createEntry("13/His", "D13", HIS_COLOR),
        "Period 3": createEntry("PPA", "", PPA_COLOR),
        "Period 4": createEntry("10B/His", "D13", HIS_COLOR),
        "Period 5": createEntry("10B/His", "D13", HIS_COLOR),
        "Period 6": null,
      },
      Thursday: {
        "Morning Mtg": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 1": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 2": createEntry("7T/Eth", "D13", ETH_COLOR),
        "Period 3": createEntry("13/His", "D13", HIS_COLOR),
        "Period 4": createEntry("12His/", "D13", HIS_COLOR),
        "Period 5": createEntry("8S/His", "D13", HIS_COLOR),
        "Period 6": createEntry("12/His", "D13", HIS_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 1": createEntry("11E", "EV3", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": createEntry("11A/His", "D13", HIS_COLOR),
        "Period 4": createEntry("10B/His", "D13", HIS_COLOR),
        "Period 5": null,
        "Period 6": null,
      },
    },
  },
  {
    name: "Ms A JONES (AJ)",
    week1: {
      Monday: {
        "Morning Mtg": createEntry("7E", "EP11", ADMIN_COLOR),
        "Period 1": createEntry("11A/Con", "VO6", CON_COLOR),
        "Period 2": createEntry("10A/Con", "VO6", CON_COLOR),
        "Period 3": createEntry("10A/Con", "V06", CON_COLOR),
        "Period 4": null,
        "Period 5": null,
        "Period 6": createEntry("7Y2/Mat1", "EP2", MATH_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("7E", "EP11", ADMIN_COLOR),
        "Period 1": createEntry("7Ε", "ΕΡΙΙ", ADMIN_COLOR),
        "Period 2": createEntry("HC/Con", "VO6", CON_COLOR),
        "Period 3": createEntry("10A/Con", "V06", CON_COLOR),
        "Period 4": createEntry("11B/Con", "VO6", CON_COLOR),
        "Period 5": createEntry("9EDT/", "VO6", DT_COLOR),
        "Period 6": createEntry("HIC/Con", "VO6", CON_COLOR),
      },
      Wednesday: {
        "Morning Mtg": createEntry("7E", "EP11", ADMIN_COLOR),
        "Period 1": createEntry("78", "ΕΡΙΙ", ADMIN_COLOR),
        "Period 2": createEntry("10B/Con", "VO6", CON_COLOR),
        "Period 3": createEntry("11B/Con", "V06", CON_COLOR),
        "Period 4": createEntry("10C/Con", "VO6", CON_COLOR),
        "Period 5": null,
        "Period 6": createEntry("10A/Con", "VO6", CON_COLOR),
      },
      Thursday: {
        "Morning Mtg": createEntry("ZE EPLI", "", ADMIN_COLOR),
        "Period 1": createEntry("7E", "EP11", ADMIN_COLOR),
        "Period 2": createEntry("10C/Con", "VO6", CON_COLOR),
        "Period 3": createEntry("11C/Con", "V06", CON_COLOR),
        "Period 4": createEntry("11A/Con", "VO6", CON_COLOR),
        "Period 5": createEntry("10B/Con", "VO6", CON_COLOR),
        "Period 6": createEntry("PPA", "", PPA_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("EPI", "", ADMIN_COLOR),
        "Period 1": createEntry("7E", "EP11", ADMIN_COLOR),
        "Period 2": createEntry("HB/Con", "VO6", CON_COLOR),
        "Period 3": createEntry("10B/Con", "V06", CON_COLOR),
        "Period 4": createEntry("11C/Con", "VO6", CON_COLOR),
        "Period 5": createEntry("10C/Con", "VO6", CON_COLOR),
        "Period 6": createEntry("HA/Con", "VO6", CON_COLOR),
      },
    },
    week2: {
      Monday: {
        "Morning Mtg": null,
        "Period 1": createEntry("7E", "EP11", ADMIN_COLOR),
        "Period 2": createEntry("9M/DT", "VO6", DT_COLOR),
        "Period 3": createEntry("PPA", "", PPA_COLOR),
        "Period 4": createEntry("10A/Con", "VO6", CON_COLOR),
        "Period 5": createEntry("10A/Con", "V06", CON_COLOR),
        "Period 6": createEntry("11A/Con", "VO6", CON_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("7E", "EP11", ADMIN_COLOR),
        "Period 1": createEntry("7E", "EP11", ADMIN_COLOR),
        "Period 2": createEntry("10A/Con", "VO6", CON_COLOR),
        "Period 3": createEntry("11C/Con", "V06", CON_COLOR),
        "Period 4": createEntry("11B/Con", "VO6", CON_COLOR),
        "Period 5": createEntry("11A/Con", "VO6", CON_COLOR),
        "Period 6": createEntry("11C/Con", "VO6", CON_COLOR),
      },
      Wednesday: {
        "Morning Mtg": createEntry("7E", "EP11", ADMIN_COLOR),
        "Period 1": createEntry("7E", "EP11", ADMIN_COLOR),
        "Period 2": createEntry("10C/Con", "VO6", CON_COLOR),
        "Period 3": createEntry("11A/Con", "VO6", CON_COLOR),
        "Period 4": createEntry("10B/Con", "VO6", CON_COLOR),
        "Period 5": createEntry("10C/Con", "V06", CON_COLOR),
        "Period 6": createEntry("10B/Con", "VO6", CON_COLOR),
      },
      Thursday: {
        "Morning Mtg": createEntry("EPI", "", ADMIN_COLOR),
        "Period 1": createEntry("7E", "EP11", ADMIN_COLOR),
        "Period 2": createEntry("PPA", "", PPA_COLOR),
        "Period 3": null,
        "Period 4": createEntry("11B/Con", "VO6", CON_COLOR),
        "Period 5": createEntry("11C/Con", "VO6", CON_COLOR),
        "Period 6": createEntry("10B/Con", "VO6", CON_COLOR),
      },
      Friday: {
        "Morning Mtg": createEntry("7E", "EP11", ADMIN_COLOR),
        "Period 1": createEntry("EPIT", "", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": null,
        "Period 4": null,
        "Period 5": null,
        "Period 6": createEntry("11B/Con", "VO6", CON_COLOR),
      },
    },
  },
  {
    name: "Miss L SKIPSEY (LS)",
    week1: {
      Monday: {
        "Morning Mtg": createEntry("LIM", "EV15", ADMIN_COLOR),
        "Period 1": createEntry("1IM", "EV15", ADMIN_COLOR),
        "Period 2": createEntry("10Y/Engl", "EV15", ENG_COLOR),
        "Period 3": createEntry("7W/Eng LIB", "", ENG_COLOR),
        "Period 4": createEntry("12/Eng GCSE", "EVIS", ENG_COLOR),
        "Period 5": createEntry("11Y/Eng3", "EV15", ENG_COLOR),
        "Period 6": createEntry("10X Engl", "EVIS", ENG_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("IM", "EV15", ADMIN_COLOR),
        "Period 1": createEntry("1IM", "EV15", ADMIN_COLOR),
        "Period 2": createEntry("PPA", "", PPA_COLOR),
        "Period 3": createEntry("IIY/Eng3", "EV15", ENG_COLOR),
        "Period 4": createEntry("12/Eng GCSE", "EV1S", ENG_COLOR),
        "Period 5": createEntry("HIX/Engl", "EV15", ENG_COLOR),
        "Period 6": null,
      },
      Wednesday: {
        "Morning Mtg": createEntry("11M", "EV5", ADMIN_COLOR),
        "Period 1": createEntry("11M", "EV15", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": createEntry("12 /Eng GCSE", "", ENG_COLOR),
        "Period 4": null,
        "Period 5": createEntry("10Y/Engl EVIS", "", ENG_COLOR),
        "Period 6": createEntry("PPA", "", PPA_COLOR),
      },
      Thursday: {
        "Morning Mtg": createEntry("11M", "EV15", ADMIN_COLOR),
        "Period 1": createEntry("IIM", "EV15", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": createEntry("10Y/Engl", "EV15", ENG_COLOR),
        "Period 4": createEntry("10X/Engl", "EV15", ENG_COLOR),
        "Period 5": createEntry("11Y/Eng3", "EV15", ENG_COLOR),
        "Period 6": null,
      },
      Friday: {
        "Morning Mtg": createEntry("HM", "EV15", ADMIN_COLOR),
        "Period 1": createEntry("IIM", "EV15", ADMIN_COLOR),
        "Period 2": createEntry("12/Eng GCSE", "EVIS", ENG_COLOR),
        "Period 3": createEntry("11Y/Eng3", "EV15", ENG_COLOR),
        "Period 4": createEntry("10Y/Engl", "EV15", ENG_COLOR),
        "Period 5": null,
        "Period 6": createEntry("10X/Engt", "EVIS", ENG_COLOR),
      },
    },
    week2: {
      Monday: {
        "Morning Mtg": createEntry("11M", "EV15", ADMIN_COLOR),
        "Period 1": createEntry("IIM", "EV15", ADMIN_COLOR),
        "Period 2": createEntry("12/Eng GCSE", "", ENG_COLOR),
        "Period 3": createEntry("10Y/Engl", "EV15", ENG_COLOR),
        "Period 4": createEntry("11Y/Eng3", "EV15", ENG_COLOR),
        "Period 5": createEntry("10Y/Eng1", "EV15", ENG_COLOR),
        "Period 6": createEntry("10X/Eng1", "EV15", ENG_COLOR),
      },
      Tuesday: {
        "Morning Mtg": createEntry("IM", "EV15", ADMIN_COLOR),
        "Period 1": createEntry("IIM", "EV15", ADMIN_COLOR),
        "Period 2": createEntry("11Y/Eng3", "EV15", ENG_COLOR),
        "Period 3": createEntry("PPA", "", PPA_COLOR),
        "Period 4": createEntry("12/Eng GOSE", "", ENG_COLOR),
        "Period 5": createEntry("11Y/Eng3", "EV15", ENG_COLOR),
        "Period 6": null,
      },
      Wednesday: {
        "Morning Mtg": createEntry("11M", "EV15", ADMIN_COLOR),
        "Period 1": createEntry("1IM", "EV15", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": createEntry("10X/Engl EVIS", "", ENG_COLOR),
        "Period 4": createEntry("12/Eng GCSE", "", ENG_COLOR),
        "Period 5": createEntry("10X/Eng1", "EV15", ENG_COLOR),
        "Period 6": createEntry("PPA", "", PPA_COLOR),
      },
      Thursday: {
        "Morning Mtg": createEntry("11M", "EVIS", ADMIN_COLOR),
        "Period 1": createEntry("1IM", "EV15", ADMIN_COLOR),
        "Period 2": createEntry("11Y/Eng3", "EV15", ENG_COLOR),
        "Period 3": createEntry("10Y/Engl", "EV15", ENG_COLOR),
        "Period 4": createEntry("12/Eng GCSE", "", ENG_COLOR),
        "Period 5": createEntry("10Y/Eng1", "EV15", ENG_COLOR),
        "Period 6": null,
      },
      Friday: {
        "Morning Mtg": createEntry("IM EVIS", "", ADMIN_COLOR),
        "Period 1": createEntry("1IM", "EV15", ADMIN_COLOR),
        "Period 2": null,
        "Period 3": createEntry("10X/Eng1", "EV15", ENG_COLOR),
        "Period 4": null,
        "Period 5": null,
        "Period 6": createEntry("12/Eng GOSE", "EVIS", ENG_COLOR),
      },
    },
  },
];
