const Joi = require("joi"); 


const validateRegistration = (data) => { 
    const schema = Joi.object({
        username: Joi.string().min(3).max(30).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).max(30).required(),
    });

    return schema.validate(data);
}

exports.validateRegistration = validateRegistration