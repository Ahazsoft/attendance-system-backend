const express = require("express");
const router = express.Router();
const multer = require('multer');

const prisma = require("../prisma");
const {supabase, supabaseAdmin} = require("../supabase");
const upload = multer({ storage: multer.memoryStorage() }); 

router.post("/get-user", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    const user = await prisma.employee.findUnique({ where: { id } });
    if (!user) return res.status(401).json({ error: "User Doesnt exist" });

    return res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAdmin: user.isAdmin,
        isApproved: user.isApproved,
        position: user.position,
        imageUrl: user.imageUrl,
        salary: user.salary,
        telephone: user.telephone,
        streak: user.streak,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put('/update-user/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, telephone } = req.body;
    let imageUrl = null;

    // 1. Handle Image Upload if a file is attached
    if (req.file) {
      const fileExt = req.file.originalname.split('.').pop();
      // Generate a unique filename
      const fileName = `${Date.now()}-${id}.${fileExt}`; 
      const filePath = `avatars/${fileName}`; // Folder structure inside bucket

      // Upload to Supabase 'profile-images' bucket
      const { error: uploadError } = await supabaseAdmin.storage
        .from('profile') 
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('profile')
        .getPublicUrl(filePath);

      imageUrl = publicUrlData.publicUrl;
    }

    // 2. Build the Prisma update data object
    const updateData = {
      firstName,
      lastName,
      telephone,
    };
    
    // Only update the imageUrl if a new one was generated
    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    // 3. Update the database
    const updatedUser = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    // Remove password before sending back to client
    const { password, ...userWithoutPassword } = updatedUser;
    console.log("updated")
    
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;

