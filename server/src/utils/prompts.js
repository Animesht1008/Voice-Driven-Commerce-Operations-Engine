const prompts = {
  en: {
    phase1:
      "Hi {name}, this is ShopFast calling. Your order for {product} worth rupees {amount} has been placed as Cash on Delivery. Can I confirm this order for you?",
    phase2:
      "Hi {name}, your ShopFast order for {product} is out for delivery tomorrow between 2 PM and 5 PM. Should I keep this time slot, or would you like to reschedule?",
  },
  hi: {
    phase1:
      "Namaste {name} ji, ShopFast se call kar rahe hain. Aapka {product} ka order rupees {amount} Cash on Delivery par place hua hai. Kya aap ise confirm karna chahenge?",
    phase2:
      "Namaste {name} ji, aapka ShopFast order kal dopahar 2 baje se 5 baje ke beech deliver hoga. Kya yeh slot theek hai ya aap reschedule karna chahenge?",
  },
};

const fillTemplate = (template, data) =>
  Object.entries(data).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template
  );

module.exports = { prompts, fillTemplate };
