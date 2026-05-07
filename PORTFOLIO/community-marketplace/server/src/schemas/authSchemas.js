import { body } from "express-validator";

/** Express-validator chains for `/api/v1/auth/*` (used with `validate` middleware). */
export const authValidators = {
  register: [
    body("acceptedTerms").isBoolean().custom((value) => value === true),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
  ],
  login: [body("email").isEmail().normalizeEmail(), body("password").isLength({ min: 8 })],
  google: [body("credential").isString().notEmpty()],
  changePassword: [body("currentPassword").isLength({ min: 8 }), body("newPassword").isLength({ min: 8 })],
  resendConfirmation: [body("email").isEmail().normalizeEmail()],
  verifyPhoneCode: [
    body("code")
      .isString()
      .trim()
      .notEmpty()
      .matches(/^\d{6}$/)
      .withMessage("Enter the 6-digit code from SMS."),
  ],
};
