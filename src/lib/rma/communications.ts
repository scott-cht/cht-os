import type { RmaCase } from '@/types';

export type RmaCommunicationTemplateKey = 'received_ack' | 'testing_update' | 'oow_quote' | 'shipped_back';

export function renderRmaTemplate(input: {
  templateKey: RmaCommunicationTemplateKey;
  rmaCase: RmaCase;
}): { subject: string; body: string } {
  const orderRef = input.rmaCase.shopify_order_name || input.rmaCase.shopify_order_id || 'your order';
  const customerName = input.rmaCase.customer_first_name || input.rmaCase.customer_name || 'there';
  const serial = input.rmaCase.serial_number ? `\nSerial: ${input.rmaCase.serial_number}` : '';

  switch (input.templateKey) {
    case 'received_ack':
      return {
        subject: `RMA received for ${orderRef}`,
        body: `Hi ${customerName},\n\nWe have received your return request and your case is now in our service queue.\n\nCase ID: ${input.rmaCase.id}\nOrder: ${orderRef}${serial}\n\nWe will send another update once inspection is complete.\n\nRegards,\nCHT Support`,
      };
    case 'testing_update':
      return {
        subject: `RMA inspection update for ${orderRef}`,
        body: `Hi ${customerName},\n\nYour item is currently in assessment with our technician team.\n\nCase ID: ${input.rmaCase.id}\nOrder: ${orderRef}${serial}\n\nWe will confirm next steps as soon as testing is complete.\n\nRegards,\nCHT Support`,
      };
    case 'oow_quote':
      return {
        subject: `Action required: Out-of-warranty service for ${orderRef}`,
        body: `Hi ${customerName},\n\nAfter reviewing your item, this case is currently marked as out of warranty.\n\nCase ID: ${input.rmaCase.id}\nOrder: ${orderRef}${serial}\n\nPlease reply to approve paid repair/replacement options and we will proceed.\n\nRegards,\nCHT Support`,
      };
    case 'shipped_back':
      return {
        subject: `Your serviced item has been shipped - ${orderRef}`,
        body: `Hi ${customerName},\n\nYour serviced item has now been shipped back.\n\nCase ID: ${input.rmaCase.id}\nOrder: ${orderRef}\nCarrier: ${input.rmaCase.outbound_carrier || 'TBC'}\nTracking: ${input.rmaCase.outbound_tracking_number || 'TBC'}\n\nThank you for your patience.\n\nRegards,\nCHT Support`,
      };
    default:
      return {
        subject: `RMA update for ${orderRef}`,
        body: `Hi ${customerName},\n\nWe have an update on your RMA case.\n\nCase ID: ${input.rmaCase.id}\nOrder: ${orderRef}${serial}\n\nRegards,\nCHT Support`,
      };
  }
}

export function toMailtoUrl(input: { recipient: string; subject: string; body: string }): string {
  const recipient = encodeURIComponent(input.recipient);
  const subject = encodeURIComponent(input.subject);
  const body = encodeURIComponent(input.body);
  return `mailto:${recipient}?subject=${subject}&body=${body}`;
}
