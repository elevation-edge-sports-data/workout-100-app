import {
  addDaysKey,
  applySleepNow,
  applyUpNow,
  closeOpenDay,
  labDayKey,
  localDayKey,
  manualPointTimestamp,
  noonOnDay,
  setDaySleep,
  setDayUp,
  sleepInstant,
} from "./dates";
import { publicProfile } from "./defaults";
import { milesOnDay, milesToday, scoreDays, scoreOnDay, scoreToday } from "./engine";
import { exportLab, parseProfile, serializeProfile } from "./io";
import type { DayStamp, PointEvent, Profile } from "./types";

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)} but got ${String(actual)}`);
  }
}

function at(year: number, month: number, day: number, hour: number, minute: number): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

function workout(timestamp: number, points: number, extra: Partial<PointEvent> = {}): PointEvent {
  return {
    id: `e-${timestamp}-${points}`,
    kind: "workout",
    points,
    timestamp,
    categoryId: "cardio",
    ...extra,
  };
}

function withProfile(dayStamps: DayStamp[] | undefined, events: PointEvent[] = []): Profile {
  return { ...publicProfile(), dayStamps, events };
}

function fallbackBeforeWake() {
  const ts = at(2026, 9, 25, 2, 0);
  const profile = publicProfile();
  expectEqual(localDayKey(ts), "2026-09-25", "calendar date");
  expectEqual(labDayKey(ts, profile), addDaysKey("2026-09-25", -1), "02:00 falls back to previous date");
  expectEqual(profile.dayStamps, undefined, "fallback does not invent stamps");

  const early = at(2026, 9, 25, 2, 0);
  const later = at(2026, 9, 25, 10, 0);
  const scored = withProfile(undefined, [workout(early, 120), workout(later, 10)]);
  const scores = scoreDays(scored, "2026-09-25");
  expectEqual(scores.get("2026-09-24")?.rawWorkout, 120, "02:00 scores on the previous lab day");
  expectEqual(scores.get("2026-09-24")?.overflowOut, 20, "overflow leaves the lab day");
  expectEqual(scores.get("2026-09-25")?.rawWorkout, 10, "after wake is the calendar date");
  expectEqual(scores.get("2026-09-25")?.incoming, 20, "overflow enters the next lab day");
  expectEqual(scoreToday(scored, early).day, "2026-09-24", "scoreToday at 02:00");

  const night = at(2026, 9, 22, 23, 0);
  const morning = at(2026, 9, 23, 2, 10);
  const miles = withProfile(undefined, [workout(night, 5, { source: "tracker", miles: 1.25 })]);
  expectEqual(localDayKey(night), "2026-09-22", "night calendar");
  expectEqual(localDayKey(morning), "2026-09-23", "morning calendar");
  expectEqual(milesToday(miles, morning), 1.25, "miles follow the lab day across midnight");
}

function closedStamp() {
  const up = at(2026, 9, 22, 10, 0);
  const sleep = at(2026, 9, 23, 2, 40);
  const event = at(2026, 9, 23, 1, 15);
  expectEqual(new Date(up).getDay(), 2, "fixture Tuesday");
  const profile = withProfile(
    [{ id: "tue", day: "2026-09-22", upAt: up, sleepAt: sleep }],
    [workout(event, 8)],
  );
  expectEqual(labDayKey(event, profile), "2026-09-22", "Wed 01:15 stays Tuesday");
  expectEqual(scoreToday(profile, event).day, "2026-09-22", "scoreToday uses the stamp day");
  expectEqual(scoreToday(profile, event).rawWorkout, 8, "event scores on Tuesday");

  const crossed = withProfile([
    { id: "tue", day: "2026-09-22", upAt: up, sleepAt: at(2026, 9, 23, 8, 0) },
  ]);
  expectEqual(localDayKey(at(2026, 9, 23, 7, 30)), "2026-09-23", "07:30 is Wednesday");
  expectEqual(labDayKey(at(2026, 9, 23, 7, 30), crossed), "2026-09-22", "stamp covers past wakeTime");
}

function openStamp() {
  const up = at(2026, 9, 22, 10, 0);
  const early = at(2026, 9, 23, 2, 10);
  const later = at(2026, 9, 23, 10, 0);
  const profile = withProfile(
    [{ id: "tue", day: "2026-09-22", upAt: up }],
    [workout(early, 3), workout(later, 4)],
  );
  expectEqual(labDayKey(early, profile), "2026-09-22", "open day keeps Wed 02:10");
  expectEqual(localDayKey(later), "2026-09-23", "10:00 is the next calendar date");
  expectEqual(labDayKey(later, profile), "2026-09-22", "open day keeps Wed 10:00");
  expectEqual(scoreToday(profile, early).day, "2026-09-22", "scoreToday while open");
  expectEqual(scoreToday(profile, early).rawWorkout, 7, "both events stay on Tuesday");

  const closed = closeOpenDay(profile, at(2026, 9, 23, 2, 40));
  expectEqual(closed.dayStamps?.[0]?.sleepAt, at(2026, 9, 23, 2, 40), "closeOpenDay sets sleepAt");
  expectEqual(profile.dayStamps?.[0]?.sleepAt, undefined, "closeOpenDay does not mutate");
  expectEqual(labDayKey(early, closed), "2026-09-22", "before sleep stays Tuesday");
  expectEqual(labDayKey(later, closed), "2026-09-23", "after sleep uses wakeTime");

  const bare = publicProfile();
  expectEqual(closeOpenDay(bare, early), bare, "closeOpenDay does not invent a stamp");

  const future = withProfile([
    { id: "a", day: "2026-09-21", upAt: at(2026, 9, 21, 10, 0) },
    { id: "b", day: "2026-09-22", upAt: up },
    { id: "c", day: "2026-09-24", upAt: at(2026, 9, 24, 10, 0) },
  ]);
  const shut = closeOpenDay(future, at(2026, 9, 23, 2, 40));
  expectEqual(shut.dayStamps?.[0]?.sleepAt, at(2026, 9, 23, 2, 40), "closes the earlier open day");
  expectEqual(shut.dayStamps?.[1]?.sleepAt, at(2026, 9, 23, 2, 40), "closes the later open day");
  expectEqual(shut.dayStamps?.[2]?.sleepAt, undefined, "does not close an Up that has not happened");

  const already = withProfile([{ id: "tue", day: "2026-09-22", upAt: up, sleepAt: at(2026, 9, 23, 1, 0) }]);
  expectEqual(closeOpenDay(already, at(2026, 9, 23, 5, 0)), already, "leaves an existing sleepAt");
}

function roundTrip() {
  const up = at(2026, 9, 22, 10, 0);
  const profile = withProfile(
    [{ id: "tue", day: "2026-09-22", upAt: up }],
    [
      {
        id: "manual-1",
        kind: "workout",
        points: 4,
        timestamp: at(2026, 9, 22, 12, 0),
        exerciseId: "squat",
        categoryId: "legs",
      },
    ],
  );
  profile.exercises = [
    ...profile.exercises,
    { id: "squat", name: "Squat", categoryId: "legs", tags: [] },
  ];
  const serialized = serializeProfile(profile);
  expectEqual(serialized.dayStamps?.[0]?.id, "tue", "serialize keeps stamps");
  const packJson = JSON.stringify(serialized.eventPack);
  if (packJson.includes("upAt") || packJson.includes("tue") || packJson.includes("dayStamps")) {
    throw new Error("packer packed a stamp");
  }
  const exported = JSON.parse(exportLab({ activeProfileId: profile.id, profiles: [profile] })) as {
    profiles: unknown[];
  };
  const back = parseProfile(exported.profiles[0], publicProfile());
  expectEqual(back.dayStamps?.[0]?.upAt, up, "export round-trip upAt");
  expectEqual(back.dayStamps?.[0]?.sleepAt, undefined, "open stamp stays open");
  const unpacked = back.events.find((event) => event.id === "hist-squat-2026-09-22");
  expectEqual(unpacked?.points, 4, "workout still unpacks beside stamps");

  const phone = parseProfile(
    {
      id: "public",
      dayStamps: [{ id: "tue", day: "2026-09-22", upAt: 111, sleepAt: 222 }],
      events: [{ id: "evt-1", kind: "workout", points: 1, timestamp: 111 }],
    },
    publicProfile(),
  );
  expectEqual(phone.dayStamps?.[0]?.sleepAt, 222, "phone-shaped sleepAt");
  expectEqual(phone.events.some((event) => event.id === "evt-1"), true, "events stay events");

  const absent = parseProfile({ id: "public" }, publicProfile());
  expectEqual(absent.dayStamps, undefined, "missing dayStamps stays missing");
  if (exportLab({ activeProfileId: "public", profiles: [publicProfile()] }).includes("dayStamps")) {
    throw new Error("export invented dayStamps");
  }

  const cleaned = parseProfile(
    {
      dayStamps: [
        { id: "", day: "2026-09-22", upAt: 1 },
        { wokeAt: 1, sleptAt: 2 },
        { id: "ok", day: "2026-09-22", upAt: 5 },
      ],
    },
    publicProfile(),
  );
  expectEqual(cleaned.dayStamps?.length, 1, "drops invalid stamps");
  expectEqual(cleaned.dayStamps?.[0]?.id, "ok", "keeps the valid stamp");
}

function dayEdit() {
  const plain = publicProfile();
  const up = at(2026, 9, 22, 10, 0);
  const started = setDayUp(plain, "2026-09-22", up, "tue");
  expectEqual(started.dayStamps?.length, 1, "Up creates one stamp");
  expectEqual(started.dayStamps?.[0]?.id, "tue", "new Up keeps its id");
  expectEqual(started.dayStamps?.[0]?.day, "2026-09-22", "Up day is the local date");
  expectEqual(started.dayStamps?.[0]?.upAt, up, "Up stores upAt");
  expectEqual(plain.dayStamps, undefined, "setDayUp does not mutate");
  if (started.dayStamps?.[0] && "sleepAt" in started.dayStamps[0]) {
    throw new Error("new Up wrote sleepAt");
  }

  const edited = setDayUp(started, "2026-09-22", at(2026, 9, 22, 11, 0), "other");
  expectEqual(edited.dayStamps?.length, 1, "editing Up does not add a stamp");
  expectEqual(edited.dayStamps?.[0]?.id, "tue", "editing Up keeps the id");
  expectEqual(edited.dayStamps?.[0]?.upAt, at(2026, 9, 22, 11, 0), "editing Up moves upAt");
  expectEqual(edited.dayStamps?.[0]?.sleepAt, undefined, "editing Up does not close that stamp");

  const wed = setDayUp(started, "2026-09-23", at(2026, 9, 23, 9, 0), "wed");
  expectEqual(wed.dayStamps?.[0]?.sleepAt, at(2026, 9, 23, 9, 0), "new Up closes the open day");
  expectEqual(wed.dayStamps?.[1]?.id, "wed", "new day keeps its id");
  expectEqual(wed.dayStamps?.[1]?.sleepAt, undefined, "new Up stays open");
  expectEqual(started.dayStamps?.[0]?.sleepAt, undefined, "close copies");

  const sameEvening = sleepInstant("2026-09-22", "22:00", up);
  expectEqual(sameEvening, at(2026, 9, 22, 22, 0), "Sleep after Up stays on the day");
  const nextMorning = sleepInstant("2026-09-22", "02:40", up);
  expectEqual(nextMorning, at(2026, 9, 23, 2, 40), "Sleep before Up is the next date");
  const slept = setDaySleep(started, "2026-09-22", nextMorning, "x");
  expectEqual(slept.dayStamps?.[0]?.sleepAt, at(2026, 9, 23, 2, 40), "Sleep writes sleepAt");
  const reopened = setDaySleep(slept, "2026-09-22", null, "x");
  if (reopened.dayStamps?.[0] && "sleepAt" in reopened.dayStamps[0]) {
    throw new Error("clearing Sleep left sleepAt");
  }
  expectEqual(labDayKey(at(2026, 9, 23, 2, 10), reopened), "2026-09-22", "open day still covers 02:10");

  const now = at(2026, 9, 23, 2, 40);
  const stamped = applyUpNow(started, now, "wed");
  expectEqual(stamped.day, "2026-09-23", "Up now uses the local date");
  expectEqual(stamped.profile.dayStamps?.[0]?.sleepAt, now, "Up now closes the open day");
  expectEqual(stamped.profile.dayStamps?.[1]?.day, "2026-09-23", "Up now starts that date");
  expectEqual(stamped.profile.dayStamps?.[1]?.upAt, now, "Up now stores now");
  expectEqual(stamped.profile.dayStamps?.[1]?.sleepAt, undefined, "Up now leaves Sleep empty");
  expectEqual(labDayKey(now, stamped.profile), "2026-09-23", "now belongs to the new Up");

  const sameDay = applyUpNow(started, at(2026, 9, 22, 9, 30), "nope");
  expectEqual(sameDay.profile.dayStamps?.length, 1, "Up now on the same date edits");
  expectEqual(sameDay.profile.dayStamps?.[0]?.id, "tue", "same-date Up keeps the id");
  expectEqual(sameDay.profile.dayStamps?.[0]?.sleepAt, undefined, "same-date Up does not close itself");

  const sleepNow = applySleepNow(plain, at(2026, 9, 22, 23, 15), "s");
  expectEqual(sleepNow.dayStamps?.[0]?.upAt, at(2026, 9, 22, 6, 0), "Sleep now uses the fallback wake");
  expectEqual(sleepNow.dayStamps?.[0]?.sleepAt, at(2026, 9, 22, 23, 15), "Sleep now stores now");
  expectEqual(sleepNow.dayStamps?.[0]?.day, "2026-09-22", "Sleep now stays on that lab day");

  expectEqual(manualPointTimestamp(plain, "2026-09-24", ""), noonOnDay("2026-09-24"), "blank time is noon");
  expectEqual(manualPointTimestamp(plain, "2026-09-24", "15:00"), at(2026, 9, 24, 15, 0), "afternoon stays on the date");
  const early = manualPointTimestamp(plain, "2026-09-24", "02:00");
  expectEqual(early, at(2026, 9, 25, 2, 0), "02:00 is the next morning");
  expectEqual(labDayKey(early ?? 0, plain), "2026-09-24", "02:00 still scores on the selected day");
  const during = manualPointTimestamp(started, "2026-09-22", "01:15");
  expectEqual(during, at(2026, 9, 23, 1, 15), "01:15 during an open day is the next date");
  expectEqual(labDayKey(during ?? 0, started), "2026-09-22", "01:15 scores on the open day");
  expectEqual(manualPointTimestamp(plain, "2026-09-24", "25:00"), null, "invalid time is refused");

  const lateRules = { ...plain, rules: { ...plain.rules, wakeTime: "18:00" } };
  expectEqual(manualPointTimestamp(lateRules, "2026-09-24", ""), at(2026, 9, 24, 18, 0), "noon before wake uses wake");

  const scored = withProfile(undefined, [workout(at(2026, 9, 25, 2, 0), 120, { source: "tracker", miles: 1.25 })]);
  expectEqual(scoreOnDay(scored, "2026-09-24").rawWorkout, 120, "scoreOnDay uses the lab day");
  expectEqual(milesOnDay(scored, "2026-09-24"), 1.25, "milesOnDay uses the lab day");
}

fallbackBeforeWake();
closedStamp();
openStamp();
roundTrip();
dayEdit();
console.log("lab-day tests ok");
