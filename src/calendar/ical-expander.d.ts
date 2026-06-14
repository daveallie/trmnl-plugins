declare module "ical-expander" {
  interface IcalTime {
    toJSDate(): Date;
    isDate: boolean;
  }
  interface IcalEvent {
    summary: string;
    startDate: IcalTime;
  }
  interface IcalOccurrence {
    startDate: IcalTime;
    item: IcalEvent;
  }
  interface BetweenResult {
    events: IcalEvent[];
    occurrences: IcalOccurrence[];
  }
  export default class IcalExpander {
    constructor(opts: { ics: string; maxIterations?: number });
    between(after: Date, before: Date): BetweenResult;
  }
}
