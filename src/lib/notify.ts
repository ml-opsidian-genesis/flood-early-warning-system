import { prisma } from "./prisma";
import { sendWhatsApp } from "./twilio";

/** Send a WhatsApp confirmation listing the subscriber's current locations
 *  (or an unsubscribed notice when the list is empty). Best-effort. */
export async function sendSubscriptionConfirmation(
  phone: string,
  locationIds: string[],
): Promise<void> {
  let body: string;
  if (locationIds.length === 0) {
    body = "🔕 *FloodGuard*\n\nYou've been unsubscribed from all flood-risk alerts.";
  } else {
    const locs = await prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { name: true, district: true },
      orderBy: { name: "asc" },
    });
    const list = locs.map((l) => `• ${l.name}, ${l.district}`).join("\n");
    body =
      "✅ *FloodGuard — subscription confirmed*\n\n" +
      `You'll receive flood-risk alerts for:\n${list}\n\n` +
      "You can edit or unsubscribe anytime from the FloodGuard site.";
  }

  try {
    await sendWhatsApp(phone, body);
  } catch {
    // Confirmation is best-effort; never fail the request on a messaging error.
  }
}
