import { body } from "express-validator";

export const authSchemas = {
  register: [
    body("acceptedTerms").isBoolean().custom((value) => value === true),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
  ],
  login: [body("email").isEmail().normalizeEmail(), body("password").isLength({ min: 8 })],
  google: [body("credential").isString().notEmpty()],
};
