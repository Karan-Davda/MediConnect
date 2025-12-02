# Step-by-Step Guide: Testing Notification System

## Prerequisites
1. ✅ Backend server is running
2. ✅ Frontend is running
3. ✅ Resend API key is configured in `.env` file
4. ✅ Database is connected

---

## Step 1: Create a Patient Account

### Option A: Via UI (Recommended)
1. Open your browser and go to: `http://localhost:5173/register/patient/step1`
2. Fill in the registration form:
   - **Full Name**: Test Patient (or any name)
   - **Email**: Use a **real email address** (you'll receive test notifications here)
   - **Password**: Must be at least 8 characters with uppercase, lowercase, number, and special character
   - **Confirm Password**: Same as password
3. Click "Continue" to go to Step 2
4. Fill in Step 2:
   - **Phone Number**: +1-555-1234 (or any format)
   - **Date of Birth**: Any date
   - **Country**: United States (or any)
   - **State**: Any state
   - **City**: Any city
5. Click "Register"
6. You'll be redirected to login page

### Option B: Via API (Alternative)
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "role": "patient",
    "auth": {
      "email": "testpatient@example.com",
      "password": "Test1234!"
    },
    "profile": {
      "full_name": "Test Patient",
      "phone": "+1-555-1234",
      "dob": "1990-01-01",
      "country": "United States",
      "state": "CA",
      "city": "San Francisco"
    }
  }'
```

---

## Step 2: Sync Patient to In-Memory Storage

The notification system uses in-memory storage. After registering, you need to sync the patient:

```bash
cd "/Users/karandavda/Desktop/CS691 Capstone/MediConnect/Backend"
node test-notifications.js
```

When prompted, enter the email address you used to register the patient.

**Note**: The script will:
- Find your patient in the database
- Create a corresponding patient record in in-memory storage
- Link them via `userId`

---

## Step 3: Enable Email Notifications (Optional)

1. Log in as the patient you just created
2. Go to **Account** page (`/account`)
3. Scroll to **Notifications** section
4. Click **Edit**
5. Check **Email reminders** checkbox
6. Click **Save**

---

## Step 4: Create a Doctor/Provider Account

You need a provider account to create medical records and trigger notifications.

### Via UI:
1. Go to: `http://localhost:5173/register/provider`
2. Fill in:
   - **Role**: Select "Doctor"
   - **Full Name**: Dr. Test Provider
   - **Email**: doctor@example.com (different from patient)
   - **Password**: Test1234!
   - **Phone**: +1-555-5678
   - **Specialty**: General Practice (or any)
   - **Country/State/City**: Any
3. Click "Register"

---

## Step 5: Test Automatic Notifications

### Scenario: Critical Lab Result Triggers Automatic Notification

1. **Log in as the Doctor** you created in Step 4
2. Go to **Medical Records** page (`/medical-records`)
3. Click **"+ Add Medical Record"**
4. Fill in the form:
   - **Patient**: Select the patient you created
   - **Visit Date**: Today's date
   - **Visit Type**: Routine
   - **Lab Results Section**: Click **"+ Add"**
     - **Test Name**: Blood Test
     - **Result**: 150
     - **Status**: Select **"Critical"** ⚠️ (This triggers automatic notification!)
   - Fill in other fields as needed
5. Click **"Add Record"**

**What happens:**
- ✅ Medical record is created
- ✅ System detects "Critical" status
- ✅ **Automatic notification is triggered**
- ✅ Patient receives:
  - 📧 Email notification (if emailReminders enabled)
  - 🔔 In-app notification (always)

---

## Step 6: Test Manual Notifications

1. **Log in as the Doctor**
2. Go to **Medical Records** page
3. Find any medical record (with or without lab results)
4. Click the **"🔔 Notify Patient"** button on the record card
5. Wait for success message

**What happens:**
- ✅ Notification is sent immediately
- ✅ Patient receives notification regardless of lab result status

---

## Step 7: View Notifications as Patient

1. **Log in as the Patient** you created
2. Look at the **header** (top right)
3. You should see a **bell icon 🔔** with a **red badge** showing unread count
4. Click the **bell icon**
5. You'll see a dropdown with all notifications:
   - Test name
   - Status badge (Critical/Abnormal/Normal)
   - Date and time
   - "New" indicator for unread notifications
6. Click any notification to:
   - Mark it as read
   - Navigate to Medical Records page

---

## Step 8: Verify Email Notifications

1. Check the **email inbox** of the patient email you registered
2. You should see an email from "MediConnect" with:
   - Subject: "🚨 New Test Result Available - [Test Name]"
   - HTML formatted email with test details
   - Critical result warning (if applicable)

**Note**: 
- Email notifications only work if:
  - ✅ Resend API key is configured
  - ✅ Patient has `emailReminders: true` in preferences
  - ✅ Patient email is valid and verified in Resend

---

## Troubleshooting

### No notification badge appears
- ✅ Check you're logged in as a **patient** (not doctor)
- ✅ Verify patient exists in in-memory storage (run `test-notifications.js`)
- ✅ Check browser console for errors

### Email not received
- ✅ Verify Resend API key in `.env` file
- ✅ Check patient has `emailReminders: true` in Account settings
- ✅ Check Resend dashboard for email delivery status
- ✅ Verify sender email domain is verified in Resend

### "Patient not found" error
- ✅ Run `test-notifications.js` to sync patient to in-memory storage
- ✅ Verify patient was registered with correct email

### Notifications not triggering automatically
- ✅ Ensure lab result status is **"Critical"** or **"Abnormal"**
- ✅ Check backend console logs for errors
- ✅ Verify medical record was created successfully

---

## Quick Test Checklist

- [ ] Patient account created
- [ ] Patient synced to in-memory storage
- [ ] Doctor account created
- [ ] Medical record created with Critical lab result
- [ ] Notification badge appears for patient
- [ ] Email notification received (if enabled)
- [ ] In-app notification visible in dropdown
- [ ] Manual "Notify Patient" button works

---

## Next Steps

Once testing is complete:
1. Test with multiple patients
2. Test with different lab result statuses (Normal, Abnormal, Critical)
3. Test notification preferences (enable/disable email/SMS)
4. Test retry logic (temporarily break email service to see retries)

Happy testing! 🎉

