import Joi from "Joi";

export const validateRegistration = (data) => {
  const schema = Joi.object({
    username: Joi.string().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(30).required(),
  });

  return schema.validate(data);
};



export const validateLogin = (data) =>{
  const schema  = Joi.object({
    username : Joi.string().min(3).max(50),
    email:Joi.string().email().required(),
    password:Joi.string().min(6).required()
  })

  return schema.validate(data);

}
