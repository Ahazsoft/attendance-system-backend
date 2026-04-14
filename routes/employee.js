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

    // 1. Fetch current employee to get the old image URL
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: parseInt(id) },
      select: { imageUrl: true },
    });

    if (!currentEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const oldImageUrl = currentEmployee.imageUrl;

    // 2. Handle new image upload if a file is attached
    if (req.file) {
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${id}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('profile')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseAdmin.storage
        .from('profile')
        .getPublicUrl(filePath);

      imageUrl = publicUrlData.publicUrl;
    }

    // 3. Build update data
    const updateData = {
      firstName,
      lastName,
      telephone,
    };

    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    // 4. Update the database
    const updatedUser = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    // 5. Delete old image from Supabase (if a new one was set and old one existed)
    if (imageUrl && oldImageUrl) {
      // Extract the path from the old public URL
      // Example URL: https://<project>.supabase.co/storage/v1/object/public/profile/avatars/filename.jpg
      const urlParts = oldImageUrl.split('/');
      const bucketIndex = urlParts.indexOf('profile'); // 'profile' is the bucket name
      if (bucketIndex !== -1) {
        const oldFilePath = urlParts.slice(bucketIndex + 1).join('/');
        
        // Fire-and-forget deletion (non-blocking)
        supabaseAdmin.storage
          .from('profile')
          .remove([oldFilePath])
          .then(({ error }) => {
            if (error) console.warn('Failed to delete old profile image:', error);
            else console.log('Old profile image deleted:', oldFilePath);
          })
          .catch(err => console.warn('Unexpected error deleting old image:', err));
      }
    }

    // 6. Remove password and respond
    const { password, ...userWithoutPassword } = updatedUser;
    console.log('updated');
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

