import { useId, useState } from "react";
import {
  cacTieuChiMatKhau,
  DO_DAI_MAT_KHAU_TOI_THIEU,
  DO_DAI_MAT_KHAU_TOI_DA,
  kiemTraMatKhau,
} from "./quy-tac-mat-khau";

/** Ô mật khẩu dùng chung; nút con mắt không gửi form hoặc thay đổi giá trị. */
export function OMatKhau({
  nhan,
  id,
  disabled,
  apDungQuyTac = false,
  ...thuocTinh
}) {
  const maTuDong = useId();
  const maO = id || maTuDong;
  const [hien, setHien] = useState(false);
  const tenNut = `${hien ? "Ẩn" : "Hiện"} ${nhan.toLocaleLowerCase("vi-VN")}`;
  const maGoiY = `${maO}-quy-tac`;
  const moTa =
    [thuocTinh["aria-describedby"], apDungQuyTac ? maGoiY : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="password-field">
      <label htmlFor={maO}>{nhan}</label>
      <div className="password-control">
        <input
          {...thuocTinh}
          id={maO}
          type={hien ? "text" : "password"}
          disabled={disabled}
          minLength={
            apDungQuyTac ? DO_DAI_MAT_KHAU_TOI_THIEU : thuocTinh.minLength
          }
          maxLength={
            apDungQuyTac ? DO_DAI_MAT_KHAU_TOI_DA : thuocTinh.maxLength
          }
          aria-describedby={moTa}
          onInput={(event) => {
            thuocTinh.onInput?.(event);
            if (apDungQuyTac)
              event.currentTarget.setCustomValidity(
                kiemTraMatKhau(event.currentTarget.value) || "",
              );
          }}
        />
        <button
          className="password-toggle"
          type="button"
          disabled={disabled}
          aria-label={tenNut}
          aria-controls={maO}
          title={tenNut}
          onClick={() => setHien((current) => !current)}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {hien && <path d="m3 3 18 18" />}
          </svg>
        </button>
      </div>
      {apDungQuyTac && (
        <div className="password-rules" id={maGoiY}>
          <p>Mật khẩu cần có:</p>
          <ul>
            {cacTieuChiMatKhau(thuocTinh.value).map((tieuChi) => (
              <li key={tieuChi.id} className={tieuChi.dat ? "is-met" : ""}>
                <span role="img" aria-label={tieuChi.dat ? "Đạt" : "Chưa đạt"}>
                  {tieuChi.dat ? "✓" : "○"}
                </span>
                {tieuChi.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
