import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Email Types
type EmailType = 
  | "welcome"
  | "email_confirmation"
  | "new_message"
  | "new_inquiry"
  | "property_inquiry_received"
  | "high_views"
  | "new_recommendation"
  | "weekly_digest"
  | "password_reset"
  | "account_verified"
  | "listing_published"
  | "listing_expired"
  | "price_drop_alert"
  | "saved_search_match"
  | "reengagement"
  | "new_testimonial";

interface NotificationRequest {
  type: EmailType;
  recipientId?: string;
  recipientEmail?: string;
  recipientName?: string;
  language?: "fr" | "en";
  data?: Record<string, any>;
  // Legacy fields for backward compatibility
  senderName?: string;
  propertyTitle?: string;
  messagePreview?: string;
  viewCount?: number;
}

// Base email wrapper
const baseEmailWrapper = (content: string, previewText: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>HomeFinder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0; overflow: hidden;">${previewText}</div>
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
    ${content}
  </div>
  <div style="max-width: 600px; margin: 20px auto 0; text-align: center;">
    <p style="color: #6b7280; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} HomeFinder. Tous droits réservés.</p>
  </div>
</body>
</html>
`;

// Gradient header component
const gradientHeader = (title: string, emoji: string, gradientColors: string = "#3b82f6, #1d4ed8") => `
<div style="background: linear-gradient(135deg, ${gradientColors}); padding: 40px 30px; text-align: center;">
  <div style="font-size: 48px; margin-bottom: 10px;">${emoji}</div>
  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">${title}</h1>
</div>
`;

// Button component
const primaryButton = (text: string, url: string, gradientColors: string = "#3b82f6, #1d4ed8") => `
<a href="${url}" style="display: inline-block; background: linear-gradient(135deg, ${gradientColors}); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">${text}</a>
`;

// Email Templates
const emailTemplates: Record<EmailType, (data: any, isFr: boolean) => { subject: string; html: string }> = {
  welcome: (data, isFr) => ({
    subject: isFr ? "🏠 Bienvenue sur HomeFinder !" : "🏠 Welcome to HomeFinder!",
    html: baseEmailWrapper(`
      ${gradientHeader("HomeFinder", "🏠")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">
          ${isFr ? `Bienvenue ${data.recipientName} !` : `Welcome ${data.recipientName}!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.7;">
          ${isFr 
            ? "Nous sommes ravis de vous accueillir dans la communauté HomeFinder. Vous avez fait le premier pas vers votre futur chez-vous !" 
            : "We're thrilled to welcome you to the HomeFinder community. You've taken the first step toward your future home!"}
        </p>
        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 25px; margin: 25px 0;">
          <h3 style="color: #0369a1; margin: 0 0 15px 0; font-size: 18px;">
            ${isFr ? "🚀 Prochaines étapes" : "🚀 Next Steps"}
          </h3>
          <ul style="color: #0c4a6e; margin: 0; padding-left: 20px; line-height: 2;">
            <li>${isFr ? "Complétez votre profil" : "Complete your profile"}</li>
            <li>${isFr ? "Définissez vos préférences de recherche" : "Set your search preferences"}</li>
            <li>${isFr ? "Explorez les annonces vérifiées" : "Explore verified listings"}</li>
          </ul>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Découvrir les annonces" : "Browse Listings", "https://linklocat.Njangui.app/search")}
        </div>
      </div>
    `, isFr ? "Bienvenue sur HomeFinder !" : "Welcome to HomeFinder!")
  }),

  email_confirmation: (data, isFr) => ({
    subject: isFr ? "✉️ Confirmez votre adresse email" : "✉️ Confirm your email address",
    html: baseEmailWrapper(`
      ${gradientHeader("Vérification Email", "✉️", "#10b981, #059669")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bonjour ${data.recipientName} !` : `Hello ${data.recipientName}!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.7;">
          ${isFr 
            ? "Merci de vous être inscrit. Veuillez confirmer votre adresse email." 
            : "Thank you for signing up. Please confirm your email address."}
        </p>
        <div style="background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
          <p style="color: #166534; font-size: 14px; margin: 0;">
            ${isFr ? "Ce lien expire dans 24 heures" : "This link expires in 24 hours"}
          </p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Confirmer mon email" : "Confirm my email", data.confirmationUrl || "https://linklocat.Njangui.app/confirm", "#10b981, #059669")}
        </div>
      </div>
    `, isFr ? "Confirmez votre email" : "Confirm your email")
  }),

  new_message: (data, isFr) => ({
    subject: isFr ? `💬 Nouveau message de ${data.senderName}` : `💬 New message from ${data.senderName}`,
    html: baseEmailWrapper(`
      ${gradientHeader("Nouveau Message", "💬")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bonjour ${data.recipientName} !` : `Hello ${data.recipientName}!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr 
            ? `Vous avez reçu un nouveau message de <strong>${data.senderName}</strong> concernant :` 
            : `You received a new message from <strong>${data.senderName}</strong> about:`}
        </p>
        <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="color: #1f2937; font-weight: 600; margin: 0;">📍 ${data.propertyTitle}</p>
        </div>
        <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-left: 4px solid #3b82f6; padding: 20px; border-radius: 0 12px 12px 0; margin: 25px 0;">
          <p style="color: #1e40af; margin: 0; font-style: italic; font-size: 15px; line-height: 1.6;">
            "${(data.messagePreview || '').substring(0, 200)}${data.messagePreview && data.messagePreview.length > 200 ? '...' : ''}"
          </p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Répondre au message" : "Reply to message", "https://linklocat.Njangui.app/messages")}
        </div>
      </div>
    `, isFr ? `${data.senderName} vous a envoyé un message` : `${data.senderName} sent you a message`)
  }),

  new_inquiry: (data, isFr) => ({
    subject: isFr ? `🔔 Nouvelle demande pour "${data.propertyTitle}"` : `🔔 New inquiry for "${data.propertyTitle}"`,
    html: baseEmailWrapper(`
      ${gradientHeader("Nouvelle Demande", "🔔", "#8b5cf6, #7c3aed")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bonne nouvelle ${data.recipientName} !` : `Great news ${data.recipientName}!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? "Quelqu'un est intéressé par votre bien !" : "Someone is interested in your property!"}
        </p>
        <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border-radius: 12px; padding: 25px; margin: 25px 0;">
          <h3 style="color: #7c3aed; margin: 0 0 15px 0;">📍 ${data.propertyTitle}</h3>
          <p style="margin: 8px 0; color: #6b21a8;"><strong>${isFr ? "De:" : "From:"}</strong> ${data.inquirerName}</p>
          ${data.inquirerPhone ? `<p style="margin: 8px 0; color: #6b21a8;"><strong>${isFr ? "Téléphone:" : "Phone:"}</strong> ${data.inquirerPhone}</p>` : ''}
        </div>
        ${data.message ? `
        <div style="background: #faf5ff; border-left: 4px solid #8b5cf6; padding: 20px; border-radius: 0 12px 12px 0; margin: 20px 0;">
          <p style="color: #581c87; margin: 0; font-style: italic;">"${data.message}"</p>
        </div>
        ` : ''}
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Répondre maintenant" : "Reply now", "https://linklocat.Njangui.app/messages", "#8b5cf6, #7c3aed")}
        </div>
      </div>
    `, isFr ? "Nouvelle demande pour votre annonce" : "New inquiry for your listing")
  }),

  property_inquiry_received: (data, isFr) => ({
    subject: isFr ? `🔔 Nouvelle demande pour "${data.propertyTitle}"` : `🔔 New inquiry for "${data.propertyTitle}"`,
    html: baseEmailWrapper(`
      ${gradientHeader("Nouvelle Demande", "🔔", "#8b5cf6, #7c3aed")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bonne nouvelle ${data.recipientName} !` : `Great news ${data.recipientName}!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? "Quelqu'un est intéressé par votre bien !" : "Someone is interested in your property!"}
        </p>
        <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border-radius: 12px; padding: 25px; margin: 25px 0;">
          <h3 style="color: #7c3aed; margin: 0 0 15px 0;">📍 ${data.propertyTitle}</h3>
          <p style="margin: 8px 0; color: #6b21a8;"><strong>${isFr ? "De:" : "From:"}</strong> ${data.inquirerName}</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Répondre maintenant" : "Reply now", "https://linklocat.Njangui.app/messages", "#8b5cf6, #7c3aed")}
        </div>
      </div>
    `, isFr ? "Nouvelle demande pour votre annonce" : "New inquiry for your listing")
  }),

  high_views: (data, isFr) => ({
    subject: isFr ? `🔥 Votre annonce atteint ${data.viewCount} vues !` : `🔥 Your listing reached ${data.viewCount} views!`,
    html: baseEmailWrapper(`
      ${gradientHeader("Annonce Populaire !", "🔥", "#f59e0b, #d97706")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Félicitations ${data.recipientName} ! 🎉` : `Congratulations ${data.recipientName}! 🎉`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? "Votre annonce attire beaucoup d'attention !" : "Your listing is getting a lot of attention!"}
        </p>
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; padding: 30px; margin: 25px 0; text-align: center;">
          <p style="color: #92400e; font-size: 56px; font-weight: 800; margin: 0; line-height: 1;">${data.viewCount}</p>
          <p style="color: #b45309; font-weight: 600; margin: 8px 0 0 0; font-size: 18px;">${isFr ? "vues totales" : "total views"}</p>
        </div>
        <div style="background: #fffbeb; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="color: #92400e; font-weight: 600; margin: 0;">📍 ${data.propertyTitle}</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Voir mes statistiques" : "View my statistics", "https://linklocat.Njangui.app/dashboard", "#f59e0b, #d97706")}
        </div>
      </div>
    `, isFr ? `Votre annonce a atteint ${data.viewCount} vues !` : `Your listing reached ${data.viewCount} views!`)
  }),

  new_recommendation: (data, isFr) => ({
    subject: isFr ? "✨ Une nouvelle propriété qui pourrait vous plaire" : "✨ A new property you might like",
    html: baseEmailWrapper(`
      ${gradientHeader("Recommandation", "✨", "#ec4899, #db2777")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bonjour ${data.recipientName} !` : `Hello ${data.recipientName}!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? "Nous avons trouvé une propriété qui correspond à vos critères !" : "We found a property that matches your criteria!"}
        </p>
        <div style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border-radius: 12px; padding: 25px; margin: 20px 0;">
          <h3 style="color: #be185d; margin: 0 0 10px 0;">${data.propertyTitle}</h3>
          <p style="color: #9d174d; font-size: 24px; font-weight: 700; margin: 10px 0;">
            ${data.propertyPrice} FCFA<span style="font-size: 14px; font-weight: 400;">/${isFr ? "mois" : "month"}</span>
          </p>
          <p style="color: #831843; margin: 10px 0 0 0; font-size: 14px;">📍 ${data.propertyLocation}</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Voir cette propriété" : "View this property", data.propertyUrl || "https://linklocat.Njangui.app/search", "#ec4899, #db2777")}
        </div>
      </div>
    `, isFr ? "Nouvelle recommandation pour vous" : "New recommendation for you")
  }),

  weekly_digest: (data, isFr) => ({
    subject: isFr ? "📊 Votre résumé hebdomadaire HomeFinder" : "📊 Your weekly HomeFinder summary",
    html: baseEmailWrapper(`
      ${gradientHeader("Résumé Hebdomadaire", "📊", "#6366f1, #4f46e5")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bonjour ${data.recipientName} !` : `Hello ${data.recipientName}!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? "Voici ce qui s'est passé cette semaine." : "Here's what happened this week."}
        </p>
        <div style="background: #eef2ff; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
          <p style="color: #4338ca; font-size: 32px; font-weight: 700; margin: 0;">${data.totalViews || 0}</p>
          <p style="color: #6366f1; font-size: 14px; margin: 5px 0 0 0;">${isFr ? "Vues sur vos annonces" : "Views on your listings"}</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Voir mon tableau de bord" : "View my dashboard", "https://linklocat.Njangui.app/dashboard", "#6366f1, #4f46e5")}
        </div>
      </div>
    `, isFr ? "Votre résumé hebdomadaire" : "Your weekly summary")
  }),

  password_reset: (data, isFr) => ({
    subject: isFr ? "🔐 Réinitialisez votre mot de passe" : "🔐 Reset your password",
    html: baseEmailWrapper(`
      ${gradientHeader("Mot de passe", "🔐", "#ef4444, #dc2626")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bonjour ${data.recipientName} !` : `Hello ${data.recipientName}!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? "Vous avez demandé à réinitialiser votre mot de passe." : "You requested to reset your password."}
        </p>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Réinitialiser mon mot de passe" : "Reset my password", data.resetUrl || "https://linklocat.Njangui.app/reset-password", "#ef4444, #dc2626")}
        </div>
        <p style="color: #9ca3af; font-size: 13px; margin-top: 30px; text-align: center;">
          ${isFr ? "Si vous n'avez pas demandé cette réinitialisation, ignorez cet email." : "If you didn't request this reset, ignore this email."}
        </p>
      </div>
    `, isFr ? "Réinitialisez votre mot de passe" : "Reset your password")
  }),

  account_verified: (data, isFr) => ({
    subject: isFr ? `✅ Compte vérifié !` : `✅ Account verified!`,
    html: baseEmailWrapper(`
      ${gradientHeader("Compte Vérifié !", "✅", "#10b981, #059669")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bravo ${data.recipientName} ! 🎊` : `Well done ${data.recipientName}! 🎊`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? "Votre compte a été vérifié avec succès." : "Your account has been successfully verified."}
        </p>
        <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 30px; margin: 25px 0; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 15px;">🏅</div>
          <p style="color: #047857; font-weight: 700; font-size: 20px; margin: 0;">
            ${isFr ? "Profil Vérifié" : "Verified Profile"}
          </p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Voir mon profil" : "View my profile", "https://linklocat.Njangui.app/profile", "#10b981, #059669")}
        </div>
      </div>
    `, isFr ? "Votre compte est vérifié" : "Your account is verified")
  }),

  listing_published: (data, isFr) => ({
    subject: isFr ? `🎉 Votre annonce est en ligne !` : `🎉 Your listing is live!`,
    html: baseEmailWrapper(`
      ${gradientHeader("Annonce Publiée !", "🎉", "#22c55e, #16a34a")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Excellente nouvelle ${data.recipientName} !` : `Great news ${data.recipientName}!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? "Votre annonce est maintenant visible !" : "Your listing is now visible!"}
        </p>
        <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #166534; margin: 0 0 10px 0;">${data.propertyTitle}</h3>
          <p style="color: #22c55e; font-size: 20px; font-weight: 700; margin: 0;">${data.propertyPrice} FCFA</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Voir mon annonce" : "View my listing", data.propertyUrl || "https://linklocat.Njangui.app/dashboard", "#22c55e, #16a34a")}
        </div>
      </div>
    `, isFr ? "Votre annonce est en ligne" : "Your listing is live")
  }),

  listing_expired: (data, isFr) => ({
    subject: isFr ? `⏰ Votre annonce a expiré` : `⏰ Your listing has expired`,
    html: baseEmailWrapper(`
      ${gradientHeader("Annonce Expirée", "⏰", "#f59e0b, #d97706")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bonjour ${data.recipientName}` : `Hello ${data.recipientName}`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? `Votre annonce "${data.propertyTitle}" a expiré.` : `Your listing "${data.propertyTitle}" has expired.`}
        </p>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Renouveler mon annonce" : "Renew my listing", "https://linklocat.Njangui.app/dashboard", "#f59e0b, #d97706")}
        </div>
      </div>
    `, isFr ? "Votre annonce a expiré" : "Your listing has expired")
  }),

  price_drop_alert: (data, isFr) => ({
    subject: isFr ? `💰 Baisse de prix sur une propriété !` : `💰 Price drop on a property!`,
    html: baseEmailWrapper(`
      ${gradientHeader("Baisse de Prix !", "💰", "#10b981, #059669")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bonne nouvelle ${data.recipientName} !` : `Good news ${data.recipientName}!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? "Une propriété que vous suivez a baissé de prix !" : "A property you're following has dropped in price!"}
        </p>
        <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #166534; margin: 0 0 10px 0;">${data.propertyTitle}</h3>
          <p style="color: #dc2626; text-decoration: line-through; margin: 5px 0;">${data.oldPrice} FCFA</p>
          <p style="color: #22c55e; font-size: 24px; font-weight: 700; margin: 0;">${data.newPrice} FCFA</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Voir la propriété" : "View property", data.propertyUrl || "https://linklocat.Njangui.app/search", "#10b981, #059669")}
        </div>
      </div>
    `, isFr ? "Baisse de prix !" : "Price drop!")
  }),

  saved_search_match: (data, isFr) => ({
    subject: isFr ? `🔍 Nouvelle propriété correspondant à vos critères` : `🔍 New property matching your criteria`,
    html: baseEmailWrapper(`
      ${gradientHeader("Nouvelle Correspondance", "🔍", "#6366f1, #4f46e5")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bonjour ${data.recipientName} !` : `Hello ${data.recipientName}!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? "Une nouvelle propriété correspond à votre recherche sauvegardée !" : "A new property matches your saved search!"}
        </p>
        <div style="background: #eef2ff; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #4338ca; margin: 0 0 10px 0;">${data.propertyTitle}</h3>
          <p style="color: #6366f1; font-size: 20px; font-weight: 700; margin: 0;">${data.propertyPrice} FCFA</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Voir la propriété" : "View property", data.propertyUrl || "https://linklocat.Njangui.app/search", "#6366f1, #4f46e5")}
        </div>
      </div>
    `, isFr ? "Nouvelle correspondance" : "New match")
  }),

  reengagement: (data, isFr) => ({
    subject: isFr ? `👋 ${data.recipientName}, vous nous manquez !` : `👋 ${data.recipientName}, we miss you!`,
    html: baseEmailWrapper(`
      ${gradientHeader("Vous nous manquez !", "👋", "#f43f5e, #e11d48")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bonjour ${data.recipientName} !` : `Hello ${data.recipientName}!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? "Cela fait un moment que nous ne vous avons pas vu. Beaucoup de nouvelles propriétés vous attendent !" : "It's been a while since we've seen you. Many new properties are waiting for you!"}
        </p>
        <div style="background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%); border-radius: 12px; padding: 25px; margin: 25px 0;">
          <h3 style="color: #be123c; margin: 0 0 15px 0;">${isFr ? "Depuis votre dernière visite :" : "Since your last visit:"}</h3>
          <ul style="color: #9f1239; margin: 0; padding-left: 20px; line-height: 2;">
            <li>${data.newListingsCount || "50+"} ${isFr ? "nouvelles propriétés ajoutées" : "new properties added"}</li>
          </ul>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Revenir sur HomeFinder" : "Come back to HomeFinder", "https://linklocat.Njangui.app", "#f43f5e, #e11d48")}
        </div>
      </div>
    `, isFr ? "Nous avons de nouvelles propriétés pour vous !" : "We have new properties for you!")
  }),

  new_testimonial: (data, isFr) => ({
    subject: isFr ? `⭐ Nouveau témoignage en attente de validation` : `⭐ New testimonial pending approval`,
    html: baseEmailWrapper(`
      ${gradientHeader("Nouveau Témoignage", "⭐", "#8b5cf6, #7c3aed")}
      <div style="padding: 40px 30px;">
        <h2 style="color: #1f2937; margin-top: 0;">
          ${isFr ? `Bonjour Admin !` : `Hello Admin!`}
        </h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${isFr ? "Un nouveau témoignage a été soumis et attend votre validation." : "A new testimonial has been submitted and awaits your approval."}
        </p>
        <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border-radius: 12px; padding: 25px; margin: 25px 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <strong style="color: #7c3aed;">${isFr ? "Auteur:" : "Author:"}</strong>
            <span style="color: #6b21a8;">${data.authorName || "Utilisateur"}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
            <strong style="color: #7c3aed;">${isFr ? "Note:" : "Rating:"}</strong>
            <span style="color: #f59e0b;">${"⭐".repeat(data.rating || 5)}</span>
          </div>
          <div style="background: white; border-radius: 8px; padding: 15px; border-left: 4px solid #8b5cf6;">
            <p style="color: #581c87; margin: 0; font-style: italic; line-height: 1.6;">
              "${(data.content || '').substring(0, 300)}${data.content && data.content.length > 300 ? '...' : ''}"
            </p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          ${primaryButton(isFr ? "Voir le témoignage" : "View testimonial", "https://linklocat.Njangui.app/admin", "#8b5cf6, #7c3aed")}
        </div>
      </div>
    `, isFr ? "Nouveau témoignage en attente" : "New testimonial pending")
  })
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotificationRequest = await req.json();
    const { type, recipientId, language = "fr", data = {} } = body;
    let recipientEmail = body.recipientEmail;
    let recipientName = body.recipientName;

    // Merge legacy fields into data for backward compatibility
    const templateData: Record<string, any> = {
      ...data,
      senderName: body.senderName || data.senderName,
      propertyTitle: body.propertyTitle || data.propertyTitle,
      messagePreview: body.messagePreview || data.messagePreview,
      viewCount: body.viewCount || data.viewCount,
    };

    // If recipientId is provided, fetch email and name
    if (recipientId && !recipientEmail) {
      const { data: authUser } = await supabase.auth.admin.getUserById(recipientId);
      recipientEmail = authUser?.user?.email;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", recipientId)
        .single();
      
      recipientName = profile?.full_name || "Utilisateur";
    }

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "No recipient email found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check user's notification preferences
    let shouldSend = true;
    if (recipientId) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", recipientId)
        .single();

      if (prefs) {
        // Check email preferences based on notification type
        const emailPrefMap: Record<string, string> = {
          new_message: "email_new_message",
          new_inquiry: "email_new_inquiry",
          property_inquiry_received: "email_new_inquiry",
          high_views: "email_property_views",
          new_recommendation: "email_recommendations",
          weekly_digest: "email_weekly_digest",
          reengagement: "email_marketing",
        };

        const prefKey = emailPrefMap[type];
        if (prefKey && prefs[prefKey] === false) {
          shouldSend = false;
        }

        // Check quiet hours
        if (prefs.quiet_hours_enabled) {
          const now = new Date();
          const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          const start = prefs.quiet_hours_start;
          const end = prefs.quiet_hours_end;
          
          if (start && end) {
            if (start < end) {
              if (currentTime >= start && currentTime <= end) {
                shouldSend = false;
              }
            } else {
              // Overnight quiet hours (e.g., 22:00 to 08:00)
              if (currentTime >= start || currentTime <= end) {
                shouldSend = false;
              }
            }
          }
        }
      }
    }

    if (!shouldSend) {
      console.log(`Notification skipped due to user preferences: ${type} for ${recipientEmail}`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "User preferences" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get email template
    const templateFn = emailTemplates[type];
    if (!templateFn) {
      return new Response(
        JSON.stringify({ error: `Unknown notification type: ${type}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const isFr = language !== "en";
    const { subject, html } = templateFn({ ...templateData, recipientName }, isFr);

    // Send email
    const emailResponse = await resend.emails.send({
      from: "HomeFinder <onboarding@resend.dev>",
      to: [recipientEmail],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log notification in history (using service role, bypasses RLS)
    try {
      await supabase.from("notification_history").insert({
        user_id: recipientId || "00000000-0000-0000-0000-000000000000",
        notification_type: type,
        channel: "email",
        title: subject,
        content: templateData.messagePreview || templateData.propertyTitle || null,
        metadata: templateData,
      });
    } catch (logError) {
      console.log("Failed to log notification:", logError);
    }

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
