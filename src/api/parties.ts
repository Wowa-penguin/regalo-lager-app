import constants from "@/constants/const";
import { FinishPartyResult, JoinPartyResult, Party } from "@/types/party";
import { getAuthHeaders } from "@/utils/auth";

// ── Types ────────────────────────────────────────────────────────────────────

interface FinishPartyLine {
  line_id: number;
  collected_qty: number;
}

// ── Parties ───────────────────────────────────────────────────────────────────

export const fetchParties = async (): Promise<Party[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch parties");
  const json = await res.json();
  return json.parties ?? [];
};

export const fetchParty = async (partyId: number): Promise<Party> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties/${partyId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch party");
  return res.json();
};

export const createParty = async (
  invoiceNumber: number,
  name: string,
): Promise<Party> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ invoice_number: invoiceNumber, name }),
  });
  if (!res.ok) throw new Error("Failed to create party");
  return res.json();
};

export const joinParty = async (
  partyId: number,
  name: string,
): Promise<JoinPartyResult> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties/${partyId}/join`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to join party");
  return res.json();
};

export const finishParty = async (
  partyId: number,
  payload: { name: string; basket: number; lines: FinishPartyLine[] },
): Promise<FinishPartyResult> => {
  const res = await fetch(
    `${constants.apiUrl}/regalo/parties/${partyId}/finish`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error("Failed to finish party");
  return res.json();
};

export const deleteParty = async (partyId: number): Promise<void> => {
  await fetch(`${constants.apiUrl}/regalo/parties/${partyId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
};
