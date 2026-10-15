<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f9; padding:40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
                    
                    {{-- Header --}}
                    <tr>
                        <td style="background: linear-gradient(135deg, #0e4b65 0%, #1a6b8a 100%); padding:32px 40px; text-align:center;">
                            <h1 style="color:#ffffff; font-size:22px; font-weight:700; margin:0; letter-spacing:0.5px;">
                                Solo Parent Portal
                            </h1>
                            <p style="color:rgba(255,255,255,0.8); font-size:13px; margin:6px 0 0 0;">
                                City Social Welfare &amp; Development Department — Butuan City
                            </p>
                        </td>
                    </tr>

                    {{-- Body --}}
                    <tr>
                        <td style="padding:36px 40px 20px 40px;">
                            <p style="font-size:16px; color:#1a1a2e; margin:0 0 16px 0;">
                                Hello <strong>{{ $userName }}</strong>,
                            </p>
                            <p style="font-size:15px; color:#444; line-height:1.6; margin:0 0 24px 0;">
                                Thank you for registering for the Solo Parent Portal. To complete your registration, please use the verification code below:
                            </p>
                        </td>
                    </tr>

                    {{-- Code --}}
                    <tr>
                        <td align="center" style="padding:0 40px 24px 40px;">
                            <div style="background:#f0f7fb; border:2px dashed #0e4b65; border-radius:10px; padding:20px 32px; display:inline-block;">
                                <span style="font-size:36px; font-weight:800; letter-spacing:10px; color:#0e4b65; font-family:'Courier New', monospace;">
                                    {{ $code }}
                                </span>
                            </div>
                        </td>
                    </tr>

                    {{-- Expiration notice --}}
                    <tr>
                        <td style="padding:0 40px 28px 40px;">
                            <p style="font-size:14px; color:#666; line-height:1.6; margin:0 0 8px 0; text-align:center;">
                                This code will expire in <strong>{{ $expiresInMinutes }} minutes</strong>.
                            </p>
                            <p style="font-size:14px; color:#666; line-height:1.6; margin:0; text-align:center;">
                                If you did not create an account on the Solo Parent Portal, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>

                    {{-- Security Warning --}}
                    <tr>
                        <td style="padding:0 40px 32px 40px;">
                            <div style="background:#fff8e6; border-left:4px solid #e6a817; border-radius:6px; padding:14px 18px;">
                                <p style="font-size:13px; color:#7a6520; margin:0; line-height:1.5;">
                                    <strong>⚠ Security Notice:</strong> Never share this verification code with anyone. CSWDD staff will never ask for your verification code.
                                </p>
                            </div>
                        </td>
                    </tr>

                    {{-- Footer --}}
                    <tr>
                        <td style="background-color:#f8f9fa; padding:24px 40px; border-top:1px solid #e8e8e8;">
                            <p style="font-size:12px; color:#999; text-align:center; margin:0 0 6px 0;">
                                Solo Parent Portal — Powered by RA 11861 (Expanded Solo Parents Welfare Act)
                            </p>
                            <p style="font-size:12px; color:#999; text-align:center; margin:0 0 6px 0;">
                                City Social Welfare &amp; Development Department, Butuan City
                            </p>
                            <p style="font-size:12px; color:#999; text-align:center; margin:0;">
                                Contact: (085) 342-5620 | Data protected under RA 10173
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
