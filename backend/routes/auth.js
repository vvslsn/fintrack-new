const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");

const router = express.Router();

router.post("/register", async (req, res) => {

    try {

        const {
            fullName,
            username,
            email,
            phone,
            password,
            confirmPassword
        } = req.body;
        console.log("Received registration data:", req.body);

        // ==========================================
        // 1. REQUIRED FIELD VALIDATION
        // ==========================================

        if (
            !fullName ||
            !username ||
            !email ||
            !phone ||
            !password ||
            !confirmPassword
        ) {

            return res.status(400).json({

                success: false,

                message: "All fields are required"

            });

        }


        // ==========================================
        // 2. PASSWORD MATCH
        // ==========================================

        if (password !== confirmPassword) {

            return res.status(400).json({

                success: false,

                message: "Passwords do not match"

            });

        }


        // ==========================================
        // 3. PASSWORD VALIDATION
        // ==========================================

        const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

        if (!passwordRegex.test(password)) {

            return res.status(400).json({

                success: false,

                message:
                    "Password must contain 8 characters, uppercase, lowercase, number and special character"

            });

        }


        // ==========================================
        // 4. PHONE VALIDATION
        // ==========================================

        if (!/^\d{10}$/.test(phone)) {

            return res.status(400).json({

                success: false,

                message: "Phone number must be exactly 10 digits"

            });

        }


        // ==========================================
        // 5. CHECK EXISTING USER
        // ==========================================

        const existingUser = await User.findOne({

            $or: [
                { username: username.trim() },
                { email: email.trim().toLowerCase() },
                { phone: phone.trim() }
            ]

        });

        if (existingUser) {

            return res.status(409).json({

                success: false,

                message:
                    "Username, email or phone number already exists"

            });

        }


        // ==========================================
        // 6. HASH PASSWORD
        // ==========================================

        const passwordHash = await bcrypt.hash(
            password,
            12
        );


        // ==========================================
        // 7. CREATE ADMIN ACCOUNT
        // ==========================================

        const newUser = new User({

            fullName: fullName.trim(),

            username: username.trim(),

            email: email.trim().toLowerCase(),

            phone: phone.trim(),

            passwordHash: passwordHash,

            role: "admin",

            memberId: null

        });


        // ==========================================
        // 8. SAVE TO MONGODB
        // ==========================================

        const savedUser = await newUser.save();


        // ==========================================
        // 9. SUCCESS RESPONSE
        // ==========================================

        res.status(201).json({

            success: true,

            message: "Admin account created successfully",

            user: {

                id: savedUser._id,

                fullName: savedUser.fullName,

                username: savedUser.username,

                email: savedUser.email,

                phone: savedUser.phone,

                role: savedUser.role

            }

        });


    } catch (error) {

        console.error(
            "Registration Error:",
            error
        );


        // Handle MongoDB duplicate key errors
        if (error.code === 11000) {

            return res.status(409).json({

                success: false,

                message: "Username, email or phone already exists"

            });

        }


        res.status(500).json({

            success: false,

            message: "Server error during registration"

        });

    }

});

router.post("/admin/login", async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;


        // ==========================================
        // 1. VALIDATE INPUT
        // ==========================================

        if (!username || !password) {

            return res.status(400).json({

                success: false,

                message: "Username and password are required"

            });

        }


        // ==========================================
        // 2. FIND ADMIN BY USERNAME
        // ==========================================

        const admin = await User.findOne({

            username: username.trim(),

            role: "admin"

        });


        // ==========================================
        // 3. CHECK ADMIN EXISTS
        // ==========================================

        if (!admin) {

            return res.status(401).json({

                success: false,

                message: "Invalid username or password"

            });

        }


        // ==========================================
        // 4. COMPARE PASSWORD
        // ==========================================

        const isPasswordValid =
            await bcrypt.compare(
                password,
                admin.passwordHash
            );


        if (!isPasswordValid) {

            return res.status(401).json({

                success: false,

                message: "Invalid username or password"

            });

        }


        // ==========================================
        // 5. UPDATE LAST LOGIN
        // ==========================================

        admin.lastLogin = new Date();

        await admin.save();


        // ==========================================
        // 6. CREATE JWT TOKEN
        // ==========================================


        // ==========================================
        // 7. SUCCESS RESPONSE
        // ==========================================

        res.status(200).json({

            success: true,

            message: "Admin login successful",

            user: {

                id: admin._id,

                fullName: admin.fullName,

                username: admin.username,

                email: admin.email,

                phone: admin.phone,

                role: admin.role

            }

        });


    } catch (error) {

        console.error(
            "Admin Login Error:",
            error
        );

        res.status(500).json({

            success: false,

            message: "Server error during admin login"

        });

    }

});


router.post("/user/login", async (req, res) => {});

router.post("/logout", async (req, res) => {});

//router.post("/forgot-password", async (req, res) => {});

module.exports = router;