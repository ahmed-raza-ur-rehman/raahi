import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.community.test.db");

import { seedDatabase } from "@/lib/db/seed";
import {
  RELIEF_NEEDS,
  createBloodRequest,
  createReliefRequest,
  findBloodBanks,
  listDonorsFor,
  matchingRequests,
  publicDonorView,
  registerDonor,
  routeRelief,
  setDonorAvailability,
  validateBloodRequest,
  validateDonor,
  validateRelief,
  maskPhone,
} from "@/lib/community";
import { HAZARDS } from "@/data/disaster";

seedDatabase();

const SESSION = "test-session-community";

const validBloodRequest = {
  sessionId: SESSION,
  patientName: "Amina Bibi",
  bloodGroup: "O+",
  units: 2,
  city: "Rawalpindi",
  hospital: "Holy Family Hospital",
  neededBy: "2026-10-05",
  contactNumber: "0300-1234567",
};

test("a blood request is rejected until every essential detail is present", () => {
  assert.equal(validateBloodRequest(validBloodRequest), undefined, "a complete request must pass");

  assert.match(validateBloodRequest({ ...validBloodRequest, patientName: "A" }) ?? "", /name/i);
  assert.match(validateBloodRequest({ ...validBloodRequest, bloodGroup: "Z+" }) ?? "", /blood group/i);
  assert.match(validateBloodRequest({ ...validBloodRequest, units: 0 }) ?? "", /units/i);
  assert.match(validateBloodRequest({ ...validBloodRequest, units: 99 }) ?? "", /units/i);
  assert.match(validateBloodRequest({ ...validBloodRequest, hospital: "" }) ?? "", /hospital/i);
  assert.match(validateBloodRequest({ ...validBloodRequest, contactNumber: "abc" }) ?? "", /phone/i);
  assert.match(validateBloodRequest({ ...validBloodRequest, neededBy: "not-a-date" }) ?? "", /date/i);
});

test("a blood request is stored and matched by group and city", () => {
  const created = createBloodRequest(validBloodRequest);
  assert.ok(created.id.startsWith("blood-"));
  assert.equal(created.bloodGroup, "O+");

  const matches = matchingRequests("O+", "Rawalpindi");
  assert.ok(
    matches.some((request) => request.id === created.id),
    "an O+ request in Rawalpindi must match an O+ search there",
  );

  const wrongCity = matchingRequests("O+", "Karachi").map((request) => request.id);
  assert.equal(wrongCity.includes(created.id), false, "city must filter the matches");
});

test("donors are validated and only matched to compatible groups", () => {
  assert.equal(
    validateDonor({ fullName: "Bilal Ahmed", bloodGroup: "A+", city: "Lahore", phone: "03001234567" }),
    undefined,
  );
  assert.match(validateDonor({ fullName: "B", bloodGroup: "A+", city: "Lahore", phone: "03001234567" }) ?? "", /name/i);
  assert.match(
    validateDonor({ fullName: "Bilal Ahmed", bloodGroup: "Z+", city: "Lahore", phone: "03001234567" }) ?? "",
    /blood group/i,
  );

  const donor = registerDonor({
    sessionId: SESSION,
    fullName: "Bilal Ahmed",
    bloodGroup: "O-",
    city: "Rawalpindi",
    phone: "03001234567",
  });
  assert.ok(donor.id.startsWith("donor-"));

  // O- is the universal donor, so it must surface for any group in that city.
  assert.ok(listDonorsFor("A+", "Rawalpindi").some((item) => item.id === donor.id));
});

test("a donor's phone is masked for everyone except the donor", () => {
  const donor = registerDonor({
    sessionId: SESSION,
    fullName: "Sana Iqbal",
    bloodGroup: "B+",
    city: "Islamabad",
    phone: "03001234567",
  });

  const own = publicDonorView(donor, SESSION);
  assert.equal(own.phone, "03001234567", "you should see your own number");

  const stranger = publicDonorView(donor, "someone-else");
  assert.notEqual(stranger.phone, "03001234567");
  assert.ok(stranger.phone.includes("*") || stranger.phone.includes("X"), "other people see a masked number");
});

test("maskPhone keeps a number recognisable but not complete", () => {
  const masked = maskPhone("03001234567");
  assert.notEqual(masked, "03001234567");
  assert.ok(masked.length > 0);
});

test("donors can mark themselves unavailable", () => {
  const donor = registerDonor({
    sessionId: SESSION,
    fullName: "Kamran Ali",
    bloodGroup: "AB+",
    city: "Peshawar",
    phone: "03001234567",
  });

  const off = setDonorAvailability(donor.id, false, SESSION);
  assert.equal(off?.available, false);

  // A different session must not be able to change someone else's availability.
  assert.equal(setDonorAvailability(donor.id, true, "someone-else"), undefined);
});

test("blood banks can be found by city", () => {
  const all = findBloodBanks();
  assert.ok(all.length > 0);

  const inCity = findBloodBanks("Lahore");
  assert.ok(inCity.length > 0);
  for (const bank of inCity) {
    // Organisations listed as "Multiple" operate nationwide, so they are
    // deliberately shown for every city.
    const nationwide = bank.city === "Multiple";
    assert.ok(
      nationwide || bank.city.toLowerCase().includes("lahore"),
      `${bank.id} is in ${bank.city} but was returned for Lahore`,
    );
  }
});

test("relief requests are validated against the known hazards and needs", () => {
  const valid = {
    sessionId: SESSION,
    hazard: "flood",
    district: "Attock",
    families: 4,
    needs: ["shelter", "food"],
    contactNumber: "0300-1234567",
  };
  assert.equal(validateRelief(valid), undefined, "a complete request must pass");

  assert.match(validateRelief({ ...valid, hazard: "alien-invasion" }) ?? "", /disaster/i);
  assert.match(validateRelief({ ...valid, district: "A" }) ?? "", /district/i);
  assert.match(validateRelief({ ...valid, families: 0 }) ?? "", /families/i);
  assert.match(validateRelief({ ...valid, needs: [] }) ?? "", /need/i);
  assert.match(validateRelief({ ...valid, contactNumber: "123" }) ?? "", /contact/i);
});

test("a relief request is routed to channels that handle that hazard", () => {
  const created = createReliefRequest({
    sessionId: SESSION,
    hazard: "flood",
    district: "Attock",
    families: 4,
    needs: ["shelter"],
    contactNumber: "0300-1234567",
  });

  assert.ok(created.routedTo.length > 0, "a request must always reach someone");
  assert.ok(created.id.startsWith("relief-"));

  const forFire = routeRelief("fire").map((channel) => channel.id);
  const forFlood = routeRelief("flood").map((channel) => channel.id);

  // Fire is a Rescue 1122 job; floods additionally involve the disaster
  // authorities. The two lists must not be identical, or hazard is ignored.
  assert.notDeepEqual(forFire, forFlood, "different hazards must route differently");

  for (const hazard of HAZARDS) {
    const routed = routeRelief(hazard.id);
    assert.ok(routed.length > 0, `${hazard.id} must route to at least one channel`);
    for (const channel of routed) {
      assert.ok(channel.numbers.length > 0, `${channel.id} must expose a callable number`);
    }
  }
});

test("an unknown hazard still routes somewhere rather than nowhere", () => {
  const routed = routeRelief("something-unheard-of");
  assert.ok(routed.length > 0, "failing loud is wrong in an emergency: give every channel");
});

test("relief needs are localised", () => {
  assert.ok(RELIEF_NEEDS.length > 0);
  for (const need of RELIEF_NEEDS) {
    assert.ok(need.label.en, `${need.id} needs an English label`);
    assert.ok(need.label.ur, `${need.id} needs an Urdu label`);
  }
});
