import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { alphabet, generateRandomString } from "oslo/crypto";

export const ResendOTPPasswordReset = Resend({
  id: "resend-otp",
  apiKey: process.env.RESEND_API_TOKEN,
  async generateVerificationToken() {
    return generateRandomString(8, alphabet("0-9"));
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);

    const { error } = await resend.emails.send({
      from: "Decorate with Convex <decorate-with-convex@mikecann.blog>",
      to: [email],
      subject: `Reset your password in Decorate with Convex`,
      text: "Your password reset code is " + token,
    });

    if (error) throw new Error(`Sending email failed: ${error}`);
  },
});
