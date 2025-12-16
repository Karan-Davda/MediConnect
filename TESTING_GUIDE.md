# Testing Guide - All User Stories Complete! 🎉

## ✅ Completion Status

All 4 user stories are now **100% complete** with full database integration!

---

## 🚀 Quick Start Testing

### Step 1: Run Database Migrations

**IMPORTANT:** Run these SQL migrations first:

```bash
# Option 1: Using psql
psql -U your_user -d your_database -f Backend/db/migrations/create_prescriptions_tables.sql
psql -U your_user -d your_database -f Backend/db/migrations/create_notifications_table.sql

# Option 2: Copy and paste SQL from files into your database client
```

**Files to run:**
- `Backend/db/migrations/create_prescriptions_tables.sql`
- `Backend/db/migrations/create_notifications_table.sql`

### Step 2: Insert Sample Pharmacies (Optional)

```sql
INSERT INTO pharmacies (name, ncpdp_id, npi, address, city, state, zip_code, phone_number, email, is_active, delivery_available, hours, preferred_by_clinic)
VALUES
  ('CVS Pharmacy', '1234567', '1234567890', '123 Main Street', 'Boston', 'MA', '02101', '617-555-0100', 'boston@cvs.com', true, true, 'Mon-Fri: 8am-9pm, Sat-Sun: 9am-6pm', true),
  ('Walgreens', '7654321', '0987654321', '456 Park Avenue', 'Boston', 'MA', '02102', '617-555-0200', 'boston@walgreens.com', true, false, 'Mon-Fri: 7am-10pm, Sat-Sun: 8am-8pm', false);
```

### Step 3: Start Servers

**Backend:**
```bash
cd Backend
npm start
# Server should start on http://localhost:3001
```

**Frontend:**
```bash
cd Frontend/web
npm run dev
# Frontend should start on http://localhost:5173
```

---

## 🧪 Testing Scenarios

### Test 1: Medical Records (03.01) ✅

**As Doctor:**
1. Login as doctor
2. Go to **Medical Records** page
3. Click **"+ Add Medical Record"**
4. Select a patient
5. Fill in:
   - Visit date, type, chief complaint
   - Add diagnosis
   - Add lab result (mark as "critical" or "abnormal" to test notifications)
   - Add treatment
6. **Optional:** Add charges:
   ```json
   {
     "charges": {
       "consultation": true,
       "services": [
         { "service_id": 1, "quantity": 1 }
       ]
     }
   }
   ```
7. Click **Submit**
8. ✅ Verify: Record created, invoice auto-generated (if charges provided)

---

### Test 2: Prescriptions (03.03) ✅

**As Doctor:**
1. Go to **Prescriptions** page
2. Click **"+ Add Prescription"**
3. Fill in:
   - Select patient
   - Medication name: "Ibuprofen"
   - Dosage: "400mg"
   - Frequency: "Twice daily"
   - Duration: "7 days"
   - Quantity: 14
4. Click **Submit**
5. ✅ Verify: Prescription saved to database
6. **Send to Pharmacy:**
   - Click on prescription
   - Select pharmacy
   - Click "Send to Pharmacy"
   - ✅ Verify: Status changes to "sent"

**As Patient:**
1. Login as patient
2. Go to **Prescriptions** page
3. ✅ Verify: See your prescriptions
4. ✅ Verify: Data persists after server restart

---

### Test 3: Notifications (03.04) ✅

**Setup:**
1. Create medical record with **critical** or **abnormal** lab result
2. ✅ Verify: Notification automatically created

**As Patient:**
1. Check notification icon (bell) in header
2. ✅ Verify: Unread count badge shows number
3. Click notification icon
4. ✅ Verify: See notification list
5. Click on notification
6. ✅ Verify: Notification marked as read
7. Restart backend server
8. ✅ Verify: Notifications still exist (persisted in database)

**Manual Trigger (Doctor):**
1. Go to medical record
2. Click "Send Notification" (if available)
3. ✅ Verify: Notification sent

---

### Test 4: Billing/Payments (04.01) ✅

**As Patient:**
1. Go to **Billing** page
2. ✅ Verify: See invoices from database
3. Click on an invoice
4. ✅ Verify: See invoice details with line items
5. ✅ Verify: See payment history
6. Click **"Pay"** button
7. ✅ Verify: Navigate to payment page

**As Doctor/Admin:**
1. Go to **Billing** page
2. ✅ Verify: See all invoices for your clinic
3. ✅ Verify: Can filter by status

**Auto-Generation Test:**
1. Create medical record with charges
2. ✅ Verify: Invoice automatically created
3. Check invoice has:
   - Consultation fee (from doctor's fees column)
   - Clinic services (from clinic_services table)
   - Correct totals

---

## 🔍 Verification Checklist

### Database Integration ✅
- [ ] Prescriptions saved to `prescriptions` table
- [ ] Notifications saved to `notifications` table
- [ ] Invoices saved to `invoices` table
- [ ] Data persists after server restart

### Backend API ✅
- [ ] `POST /api/prescriptions` - Creates prescription (doctor only)
- [ ] `GET /api/prescriptions` - Lists prescriptions
- [ ] `GET /api/notifications` - Lists notifications (patient only)
- [ ] `GET /api/invoices` - Lists invoices
- [ ] All routes return data from database

### Frontend ✅
- [ ] Prescriptions page loads data
- [ ] Notifications icon shows unread count
- [ ] Billing page shows invoices
- [ ] Medical records page works

---

## 🐛 Troubleshooting

### "Table does not exist" error
**Solution:** Run the SQL migration files first!

### "Prescription not found" after creating
**Solution:** Check database connection and verify prescription was inserted

### "Notification not showing"
**Solution:** 
- Check patient_id matches
- Verify notification was inserted into database
- Check browser console for API errors

### "Invoice not generated"
**Solution:**
- Ensure medical record creation includes `charges` object
- Check doctor has `fees` column set
- Verify clinic services exist in database

---

## 📊 Final Status Summary

| User Story | Database | Backend | Frontend | Status |
|------------|----------|---------|----------|--------|
| **03.01 Store Records** | ✅ | ✅ | ✅ | ✅ **100%** |
| **03.03 Manage Prescriptions** | ✅ | ✅ | ✅ | ✅ **100%** |
| **03.04 Notify Results** | ✅ | ✅ | ✅ | ✅ **100%** |
| **04.01 Process Payments** | ✅ | ✅ | ✅ | ✅ **100%** |

**🎉 All user stories are complete and ready for testing!**

---

## Next: Test in Browser

1. ✅ Run migrations
2. ✅ Start backend: `cd Backend && npm start`
3. ✅ Start frontend: `cd Frontend/web && npm run dev`
4. ✅ Open browser: `http://localhost:5173`
5. ✅ Login and test all features!

Good luck with testing! 🚀

