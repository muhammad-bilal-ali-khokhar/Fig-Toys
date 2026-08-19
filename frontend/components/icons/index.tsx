import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps, children: ReactNode) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          d="M5 14.0585C5 13.0494 5 12.5448 5.22166 12.1141C5.44333 11.6833 5.8539 11.3901 6.67505 10.8035L10.8375 7.83034C11.3989 7.42938 11.6795 7.2289 12 7.2289C12.3205 7.2289 12.6011 7.42938 13.1625 7.83034L17.325 10.8035C18.1461 11.3901 18.5567 11.6833 18.7783 12.1141C19 12.5448 19 13.0494 19 14.0585V19C19 19.9428 19 20.4142 18.7071 20.7071C18.4142 21 17.9428 21 17 21H7C6.05719 21 5.58579 21 5.29289 20.7071C5 20.4142 5 19.9428 5 19V14.0585Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <path
          d="M3 12.3866C3 12.6535 3 12.7869 3.0841 12.8281C3.16819 12.8692 3.27352 12.7873 3.48418 12.6234L10.7721 6.95502C11.362 6.49625 11.6569 6.26686 12 6.26686C12.3431 6.26686 12.638 6.49625 13.2279 6.95502L20.5158 12.6234C20.7265 12.7873 20.8318 12.8692 20.9159 12.8281C21 12.7869 21 12.6535 21 12.3866V11.9782C21 11.4978 21 11.2576 20.8983 11.0497C20.7966 10.8418 20.607 10.6944 20.2279 10.3995L13.2279 4.95502C12.638 4.49625 12.3431 4.26686 12 4.26686C11.6569 4.26686 11.362 4.49625 10.7721 4.95502L3.77212 10.3995C3.39295 10.6944 3.20337 10.8418 3.10168 11.0497C3 11.2576 3 11.4978 3 11.9782V12.3866Z"
          fill="currentColor"
        />
        <path
          d="M12.5 15H11.5C10.3954 15 9.5 15.8954 9.5 17V20.85C9.5 20.9328 9.56716 21 9.65 21H14.35C14.4328 21 14.5 20.9328 14.5 20.85V17C14.5 15.8954 13.6046 15 12.5 15Z"
          fill="currentColor"
        />
        <rect x="16" y="5" width="2" height="4" rx="0.5" fill="currentColor" />
      </g>
    </svg>
  );
}

export function PosIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          d="M19.7808 10H20C20.5523 10 21 9.55228 21 9C21 8.44772 20.5523 8 20 8H4C3.44772 8 3 8.44772 3 9C3 9.55228 3.44772 10 4 10H4.21922C4.67809 10 5.07807 10.3123 5.18937 10.7575L6.62127 16.4851C6.84385 17.3754 7.64382 18 8.56155 18H15.4384C16.3562 18 17.1561 17.3754 17.3787 16.4851L18.8106 10.7575C18.9219 10.3123 19.3219 10 19.7808 10Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <path d="M8.5 3.5L6.5 6.5M15.5 3.5L17.5 6.5" stroke="currentColor" strokeLinecap="round" />
        <path d="M10.5 14.5L9.5 11.5M13.5 14.5L14.5 11.5" stroke="currentColor" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function PurchasesIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          d="M4.85795 9.84661C4.92534 8.97057 4.95903 8.53256 5.24658 8.26628C5.53413 8 5.97344 8 6.85206 8H17.1479C18.0266 8 18.4659 8 18.7534 8.26628C19.041 8.53256 19.0747 8.97057 19.142 9.84661L19.3864 13.0236C19.6495 16.4434 19.781 18.1534 18.924 19.3409C18.7336 19.6047 18.5117 19.8443 18.2632 20.0544C17.1449 21 15.43 21 12 21C8.57003 21 6.85505 21 5.73678 20.0544C5.48832 19.8443 5.26641 19.6047 5.07599 19.3409C4.21897 18.1534 4.35051 16.4434 4.61357 13.0236L4.85795 9.84661Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <path d="M8.5 8L8.5 6.5C8.5 4.567 10.067 3 12 3V3C13.933 3 15.5 4.567 15.5 6.5L15.5 8" stroke="currentColor" />
        <path d="M8 11.5C8 11.7761 8.22386 12 8.5 12C8.77614 12 9 11.7761 9 11.5H8ZM9 11.5V10H8V11.5H9Z" fill="currentColor" />
        <path d="M15 11.5C15 11.7761 15.2239 12 15.5 12C15.7761 12 16 11.7761 16 11.5H15ZM16 11.5V10H15V11.5H16Z" fill="currentColor" />
      </g>
    </svg>
  );
}

export function ReturnsIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="-0.5 0 25 25"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          d="M15.9098 12.3488L14.5198 7.32881C14.4298 7.00881 14.6098 6.67881 14.9198 6.57881L19.8798 4.96881"
          stroke="currentColor"
          strokeMiterlimit="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14.0198 19.7888C17.0198 20.7088 20.2698 18.9288 21.2798 15.8188C22.2898 12.7088 20.6698 9.44882 17.6698 8.53882"
          stroke="currentColor"
          strokeMiterlimit="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M2.4198 12.4988H11.4498" stroke="currentColor" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.4198 6.62878H11.4498" stroke="currentColor" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.4198 18.3688H11.4498" stroke="currentColor" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function InventoryIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          d="M4 9.3C4 9.15858 4 9.08787 4.04393 9.04393C4.08787 9 4.15858 9 4.3 9H19.7C19.8414 9 19.9121 9 19.9561 9.04393C20 9.08787 20 9.15858 20 9.3V15C20 16.8856 20 17.8284 19.4142 18.4142C18.8284 19 17.8856 19 16 19H8C6.11438 19 5.17157 19 4.58579 18.4142C4 17.8284 4 16.8856 4 15V9.3Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <path
          d="M2 7C2 5.89543 2.89543 5 4 5H20C21.1046 5 22 5.89543 22 7C22 7.55228 21.5523 8 21 8H3C2.44772 8 2 7.55228 2 7Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <rect x="9" y="12" width="6" height="1" rx="0.5" fill="currentColor" />
      </g>
    </svg>
  );
}

export function ProductsIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          d="M20 12C20 9.19974 20 7.79961 19.455 6.73005C18.9757 5.78924 18.2108 5.02433 17.27 4.54497C16.2004 4 14.8003 4 12 4C9.19974 4 7.79961 4 6.73005 4.54497C5.78924 5.02433 5.02433 5.78924 4.54497 6.73005C4 7.79961 4 9.19974 4 12V18C4 18.9428 4 19.4142 4.29289 19.7071C4.58579 20 5.05719 20 6 20H12C14.8003 20 16.2004 20 17.27 19.455C18.2108 18.9757 18.9757 18.2108 19.455 17.27C20 16.2004 20 14.8003 20 12Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <path d="M8.5 8.5L15.5 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.5 11.5L13.5 11.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16.5" cy="15.5" r="2" stroke="currentColor" />
        <path d="M19 18L20.5 19.5" stroke="currentColor" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z" fill="currentColor" fillOpacity="0.24" />
        <circle cx="12" cy="10" r="4" fill="currentColor" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M18.2209 18.2462C18.2791 18.3426 18.2613 18.466 18.1795 18.5432C16.5674 20.0662 14.3928 21 12 21C9.60728 21 7.43264 20.0663 5.82057 18.5433C5.73877 18.466 5.72101 18.3427 5.77918 18.2463C6.94337 16.318 9.29215 15 12.0001 15C14.7079 15 17.0567 16.3179 18.2209 18.2462Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 13C8.33033 13 5.32016 15.4204 5.02395 18.5004C4.99752 18.7753 5.22389 19 5.50003 19H18.5C18.7762 19 19.0025 18.7753 18.9761 18.5004C18.6799 15.4204 15.6697 13 12 13Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
      </g>
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return base(props, (
    <>
      <rect x="4" y="10.5" width="16" height="11" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      <path d="M12 15v2.5" />
    </>
  ));
}

export function FolderIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M3.5 6.5a2 2 0 0 1 2-2h3.2a2 2 0 0 1 1.5.7l1 1.2a2 2 0 0 0 1.5.7H18.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6.5Z" />
    </>
  ));
}

export function ReportsIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 -0.5 25 25"
      fill="currentColor"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <path d="M15.5 7.75C15.0858 7.75 14.75 8.08579 14.75 8.5C14.75 8.91421 15.0858 9.25 15.5 9.25V7.75ZM19.5 9.25C19.9142 9.25 20.25 8.91421 20.25 8.5C20.25 8.08579 19.9142 7.75 19.5 7.75V9.25ZM20.25 8.5C20.25 8.08579 19.9142 7.75 19.5 7.75C19.0858 7.75 18.75 8.08579 18.75 8.5H20.25ZM18.75 12.5C18.75 12.9142 19.0858 13.25 19.5 13.25C19.9142 13.25 20.25 12.9142 20.25 12.5H18.75ZM20.0303 9.03033C20.3232 8.73744 20.3232 8.26256 20.0303 7.96967C19.7374 7.67678 19.2626 7.67678 18.9697 7.96967L20.0303 9.03033ZM12.5 15.5L11.9697 16.0303C12.2626 16.3232 12.7374 16.3232 13.0303 16.0303L12.5 15.5ZM9.5 12.5L10.0303 11.9697C9.73744 11.6768 9.26256 11.6768 8.96967 11.9697L9.5 12.5ZM4.96967 15.9697C4.67678 16.2626 4.67678 16.7374 4.96967 17.0303C5.26256 17.3232 5.73744 17.3232 6.03033 17.0303L4.96967 15.9697ZM15.5 9.25H19.5V7.75H15.5V9.25ZM18.75 8.5V12.5H20.25V8.5H18.75ZM18.9697 7.96967L11.9697 14.9697L13.0303 16.0303L20.0303 9.03033L18.9697 7.96967ZM13.0303 14.9697L10.0303 11.9697L8.96967 13.0303L11.9697 16.0303L13.0303 14.9697ZM8.96967 11.9697L4.96967 15.9697L6.03033 17.0303L10.0303 13.0303L8.96967 11.9697Z" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M14.1361 3.36144C14.0928 2.92777 14.0711 2.71093 13.9838 2.54161C13.8728 2.32656 13.6877 2.15902 13.4627 2.07005C13.2855 2 13.0676 2 12.6318 2H11.3681C10.9324 2 10.7145 2 10.5374 2.07001C10.3123 2.15898 10.1271 2.32658 10.0162 2.5417C9.9289 2.71098 9.90722 2.92776 9.86387 3.36131C9.78181 4.18195 9.74077 4.59227 9.56907 4.81742C9.35113 5.10319 8.99661 5.25003 8.64044 5.20207C8.35982 5.16427 8.04061 4.9031 7.4022 4.38076C7.06481 4.10472 6.89612 3.9667 6.71463 3.90872C6.48414 3.8351 6.23478 3.84753 6.01277 3.94373C5.83795 4.01947 5.68385 4.17357 5.37565 4.48177L4.48233 5.37509C4.17403 5.68339 4.01988 5.83754 3.94413 6.01243C3.848 6.23438 3.83557 6.48364 3.90914 6.71405C3.96711 6.89561 4.10516 7.06435 4.38128 7.40182C4.90385 8.04052 5.16514 8.35987 5.20287 8.64066C5.2507 8.99664 5.10395 9.35092 4.81842 9.56881C4.59319 9.74068 4.18264 9.78173 3.36155 9.86384C2.92777 9.90722 2.71088 9.92891 2.54152 10.0163C2.32654 10.1272 2.15905 10.3123 2.07008 10.5372C2 10.7144 2 10.9324 2 11.3683V12.6318C2 13.0676 2 13.2855 2.07005 13.4627C2.15902 13.6877 2.32656 13.8728 2.54161 13.9838C2.71093 14.0711 2.92776 14.0928 3.36143 14.1361C4.1823 14.2182 4.59273 14.2593 4.81792 14.4311C5.10357 14.649 5.25037 15.0034 5.20247 15.3594C5.16471 15.6402 4.90351 15.9594 4.3811 16.5979C4.10511 16.9352 3.96711 17.1039 3.90913 17.2854C3.8355 17.5159 3.84794 17.7652 3.94414 17.9873C4.01988 18.1621 4.17398 18.3162 4.48217 18.6243L5.37561 19.5178C5.6838 19.826 5.8379 19.9801 6.01272 20.0558C6.23474 20.152 6.4841 20.1645 6.71458 20.0908C6.89607 20.0329 7.06474 19.8949 7.40208 19.6189C8.04059 19.0964 8.35985 18.8352 8.64057 18.7975C8.99663 18.7496 9.35101 18.8964 9.56892 19.182C9.74072 19.4072 9.78176 19.8176 9.86385 20.6385C9.90722 21.0722 9.92891 21.2891 10.0162 21.4584C10.1272 21.6734 10.3123 21.841 10.5373 21.9299C10.7145 22 10.9324 22 11.3682 22H12.6316C13.0676 22 13.2856 22 13.4628 21.9299C13.6877 21.8409 13.8728 21.6735 13.9837 21.4585C14.0711 21.2891 14.0928 21.0722 14.1362 20.6383C14.2183 19.8173 14.2593 19.4068 14.4311 19.1816C14.649 18.896 15.0034 18.7492 15.3595 18.7971C15.6402 18.8348 15.9594 19.096 16.5979 19.6184C16.9352 19.8944 17.1039 20.0324 17.2854 20.0904C17.5159 20.164 17.7652 20.1516 17.9873 20.0554C18.1621 19.9796 18.3162 19.8255 18.6243 19.5174L19.5179 18.6238C19.826 18.3157 19.98 18.1617 20.0558 17.9869C20.152 17.7648 20.1645 17.5154 20.0908 17.2848C20.0328 17.1034 19.8949 16.9348 19.619 16.5976C19.0968 15.9593 18.8357 15.6402 18.7979 15.3596C18.7499 15.0034 18.8967 14.6489 19.1825 14.4309C19.4077 14.2592 19.818 14.2182 20.6386 14.1361C21.0722 14.0928 21.289 14.0711 21.4583 13.9838C21.6734 13.8729 21.841 13.6877 21.93 13.4626C22 13.2855 22 13.0676 22 12.6319V11.3682C22 10.9324 22 10.7145 21.9299 10.5373C21.841 10.3123 21.6734 10.1272 21.4584 10.0162C21.2891 9.92891 21.0722 9.90722 20.6385 9.86385C19.8176 9.78176 19.4072 9.74072 19.182 9.56893C18.8964 9.35102 18.7496 8.99662 18.7975 8.64056C18.8352 8.35984 19.0964 8.0406 19.6188 7.4021C19.8948 7.06478 20.0328 6.89612 20.0908 6.71464C20.1644 6.48415 20.152 6.23478 20.0558 6.01275C19.98 5.83794 19.8259 5.68385 19.5178 5.37567L18.6243 4.4822C18.3161 4.17402 18.162 4.01994 17.9872 3.94419C17.7652 3.84798 17.5158 3.83555 17.2853 3.90918C17.1038 3.96716 16.9352 4.10515 16.5979 4.38113C15.9594 4.90352 15.6402 5.16472 15.3595 5.20248C15.0034 5.25038 14.649 5.10358 14.4311 4.81793C14.2593 4.59274 14.2182 4.1823 14.1361 3.36144Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </g>
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          d="M4 12C4 10.1144 4 9.17157 4.58579 8.58579C5.17157 8 6.11438 8 8 8H8.78377C8.88813 8 8.94031 8 8.97959 7.97169C9.01888 7.94337 9.03538 7.89387 9.06838 7.79487L9.54415 6.36754C9.76416 5.70753 9.87416 5.37752 10.136 5.18876C10.3979 5 10.7458 5 11.4415 5H14.5585C15.2542 5 15.6021 5 15.864 5.18876C16.1258 5.37752 16.2358 5.70753 16.4558 6.36754L16.9513 7.85404C16.9652 7.89558 16.9721 7.91634 16.9831 7.93295C17.0033 7.9633 17.0338 7.98528 17.0689 7.99479C17.0882 8 17.1101 8 17.1539 8C17.9415 8 18.3354 8 18.6524 8.1094C19.2335 8.30992 19.6901 8.76651 19.8906 9.3476C20 9.66463 20 10.0585 20 10.8461V14C20 15.8856 20 16.8284 19.4142 17.4142C18.8284 18 17.8856 18 16 18H8C6.11438 18 5.17157 18 4.58579 17.4142C4 16.8284 4 15.8856 4 14V12Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <path d="M14.5 6.5H11.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="13" cy="13" r="3" fill="currentColor" />
        <rect x="4" y="6" width="3" height="1" rx="0.5" fill="currentColor" fillOpacity="0.24" />
      </g>
    </svg>
  );
}

export function SmartphoneIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <rect x="7" y="3" width="10" height="17" rx="2" fill="currentColor" fillOpacity="0.24" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
        <path
          d="M9 4.13043C9 4.0584 9.0584 4 9.13043 4H14.8696C14.9416 4 15 4.0584 15 4.13043C15 4.61068 14.6107 5 14.1304 5H9.86957C9.38932 5 9 4.61068 9 4.13043Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

export function HeadphonesIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <path d="M20,11.9425 C20,7.56202 16.4243,4 12,4 C7.57567,4 4,7.56202 4,11.9425 C4,13.1324 4.14659,13.8984 4.32843,14.4585 C4.44951,14.8313 4.74118,14.4643 4.88468,14.3297 C5.8667,13.4083 7.4021,13.4302 8.35736,14.3794 C9.77816,15.791 11.0886,17.749 9.27806,19.549 C8.30609,20.5154 6.84226,20.9173 5.72834,19.8765 C4.29036,18.5328 3.04086,16.9692 2.42619,15.0761 C2.169,14.284 2,13.3049 2,11.9425 C2,6.44539 6.4832,2 12,2 C17.5168,2 22,6.44539 22,11.9425 C22,13.3049 21.831,14.284 21.5738,15.0761 C20.9591,16.9692 19.7096,18.5328 18.2717,19.8765 C17.1577,20.9173 15.6939,20.5154 14.7219,19.549 C12.9114,17.749 14.2218,15.791 15.6426,14.3794 C16.5979,13.4302 18.1333,13.4083 19.1153,14.3297 C19.3925,14.5898 19.5286,14.8989 19.6716,14.4585 C19.8534,13.8984 20,13.1324 20,11.9425 Z" />
    </svg>
  );
}

export function FilterIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M3 5h18" />
      <path d="M6 12h12" />
      <path d="M9 19h6" />
      <circle cx="6" cy="5" r="2" />
      <circle cx="14" cy="12" r="2" />
      <circle cx="18" cy="19" r="2" />
    </>
  ));
}

export function LogoutIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ));
}

export function PlusIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ));
}

export function TagIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          opacity="0.24"
          d="M17.9665 6.55812L16.1369 4.72848L16.1369 4.72848C14.5913 3.18295 13.8186 2.41018 12.816 2.12264C11.8134 1.83509 10.7485 2.08083 8.61875 2.57231L7.39057 2.85574C5.5988 3.26922 4.70292 3.47597 4.08944 4.08944C3.47597 4.70292 3.26922 5.5988 2.85574 7.39057L2.85574 7.39057L2.57231 8.61875C2.08083 10.7485 1.83509 11.8134 2.12264 12.816C2.41018 13.8186 3.18295 14.5914 4.72848 16.1369L6.55812 17.9665L6.55813 17.9665C9.24711 20.6555 10.5916 22 12.2623 22C13.933 22 15.2775 20.6555 17.9665 17.9665L17.9665 17.9665L17.9665 17.9665C20.6555 15.2775 22 13.933 22 12.2623C22 10.5916 20.6555 9.24711 17.9665 6.55813L17.9665 6.55812Z"
          fill="currentColor"
        />
        <path
          d="M11.1469 14.3284C10.4739 13.6555 10.4796 12.6899 10.882 11.9247C10.6809 11.6325 10.7103 11.2295 10.9701 10.9697C11.2289 10.7108 11.63 10.6807 11.9219 10.8795C12.2617 10.6988 12.6351 10.6033 13.0073 10.6068C13.4215 10.6107 13.7541 10.9497 13.7502 11.3639C13.7462 11.7781 13.4073 12.1107 12.9931 12.1068C12.8162 12.1051 12.5837 12.1845 12.3843 12.3839C11.9968 12.7714 12.0987 13.1589 12.2075 13.2678C12.3164 13.3766 12.7039 13.4785 13.0914 13.091C13.8754 12.307 15.2291 12.0467 16.0966 12.9142C16.7696 13.5872 16.7639 14.5528 16.3614 15.318C16.5625 15.6102 16.5332 16.0132 16.2734 16.273C16.0145 16.5319 15.6133 16.5619 15.3214 16.3631C14.8645 16.6059 14.3448 16.6969 13.8492 16.595C13.4435 16.5117 13.1822 16.1152 13.2655 15.7094C13.3489 15.3037 13.7454 15.0424 14.1512 15.1257C14.3283 15.1622 14.6139 15.104 14.8592 14.8588C15.2467 14.4712 15.1448 14.0837 15.0359 13.9749C14.9271 13.866 14.5396 13.7641 14.1521 14.1517C13.368 14.9357 12.0143 15.1959 11.1469 14.3284Z"
          fill="currentColor"
        />
        <path d="M10.0211 10.2931C10.8022 9.51207 10.8022 8.24574 10.0211 7.46469C9.2401 6.68364 7.97377 6.68364 7.19272 7.46469C6.41167 8.24574 6.41167 9.51207 7.19272 10.2931C7.97377 11.0742 9.2401 11.0742 10.0211 10.2931Z" fill="currentColor" />
      </g>
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 19C15.866 19 19 15.866 19 12C19 8.13401 15.866 5 12 5C8.13401 5 5 8.13401 5 12C5 15.866 8.13401 19 12 19ZM10.0866 7.3806C10.6932 7.12933 11.3434 7 12 7C12.2761 7 12.5 6.77614 12.5 6.5C12.5 6.22386 12.2761 6 12 6C11.2121 6 10.4319 6.15519 9.7039 6.45672C8.97595 6.75825 8.31451 7.20021 7.75736 7.75736C7.20021 8.31451 6.75825 8.97595 6.45672 9.7039C6.15519 10.4319 6 11.2121 6 12C6 12.2761 6.22386 12.5 6.5 12.5C6.77614 12.5 7 12.2761 7 12C7 11.3434 7.12933 10.6932 7.3806 10.0866C7.63188 9.47996 8.00017 8.92876 8.46447 8.46447C8.92876 8.00017 9.47995 7.63188 10.0866 7.3806Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <path d="M20.5 20.5L17 17" stroke="currentColor" strokeLinecap="round" />
        <circle cx="11" cy="11" r="8.5" stroke="currentColor" />
      </g>
    </svg>
  );
}

export function WalletIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          d="M3 10C3 7.17157 3 5.75736 3.87868 4.87868C4.75736 4 6.17157 4 9 4H15C17.8284 4 19.2426 4 20.1213 4.87868C21 5.75736 21 7.17157 21 10V11.7C21 11.8414 21 11.9121 20.9561 11.9561C20.9121 12 20.8414 12 20.7 12H16.5C16.0353 12 15.803 12 15.6098 12.0384C14.8164 12.1962 14.1962 12.8164 14.0384 13.6098C14 13.803 14 14.0353 14 14.5C14 14.9647 14 15.197 14.0384 15.3902C14.1962 16.1836 14.8164 16.8038 15.6098 16.9616C15.803 17 16.0353 17 16.5 17H20.8571C20.936 17 21 17.064 21 17.1429C21 18.7208 19.7208 20 18.1429 20H9C6.17157 20 4.75736 20 3.87868 19.1213C3 18.2426 3 16.8284 3 14V10Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <path
          d="M14 14C14 12.8954 14.8954 12 16 12H20.85C20.9328 12 21 12.0672 21 12.15V16.85C21 16.9328 20.9328 17 20.85 17H16C14.8954 17 14 16.1046 14 15V14Z"
          fill="currentColor"
        />
        <rect x="6" y="7" width="6" height="1" rx="0.5" fill="currentColor" />
      </g>
    </svg>
  );
}

export function TrendingUpIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="m22 7-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </>
  ));
}

export function CalendarIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7 4.01833C6.46047 4.04114 6.07192 4.09237 5.72883 4.20736C4.53947 4.60599 3.60599 5.53947 3.20736 6.72883C3 7.3475 3 8.11402 3 9.64706C3 9.74287 3 9.79078 3.01296 9.82945C3.03787 9.90378 3.09622 9.96213 3.17055 9.98704C3.20922 10 3.25713 10 3.35294 10H20.6471C20.7429 10 20.7908 10 20.8294 9.98704C20.9038 9.96213 20.9621 9.90378 20.987 9.82945C21 9.79078 21 9.74287 21 9.64706C21 8.11402 21 7.3475 20.7926 6.72883C20.394 5.53947 19.4605 4.60599 18.2712 4.20736C17.9281 4.09237 17.5395 4.04114 17 4.01833L17 6.5C17 7.32843 16.3284 8 15.5 8C14.6716 8 14 7.32843 14 6.5L14 4H10L10 6.5C10 7.32843 9.32843 8 8.50001 8C7.67158 8 7 7.32843 7 6.5L7 4.01833Z"
          fill="currentColor"
        />
        <path
          d="M3 11.5C3 11.2643 3 11.1464 3.07322 11.0732C3.14645 11 3.2643 11 3.5 11H20.5C20.7357 11 20.8536 11 20.9268 11.0732C21 11.1464 21 11.2643 21 11.5V12C21 15.7712 21 17.6569 19.8284 18.8284C18.6569 20 16.7712 20 13 20H11C7.22876 20 5.34315 20 4.17157 18.8284C3 17.6569 3 15.7712 3 12V11.5Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <path d="M8.5 2.5L8.5 6.5" stroke="currentColor" strokeLinecap="round" />
        <path d="M15.5 2.5L15.5 6.5" stroke="currentColor" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ));
}

export function ChevronRightIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="m9 6 6 6-6 6" />
    </>
  ));
}

export function ChevronLeftIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="m15 6-6 6 6 6" />
    </>
  ));
}

export function ChevronUpIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="m6 15 6-6 6 6" />
    </>
  ));
}

export function ChevronDownIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="m6 9 6 6 6-6" />
    </>
  ));
}

export function AlertIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          opacity="0.24"
          d="M18.7491 9V9.7041C18.7491 10.5491 18.9903 11.3752 19.4422 12.0782L20.5496 13.8012C21.5612 15.3749 20.789 17.5139 19.0296 18.0116C14.4273 19.3134 9.57274 19.3134 4.97036 18.0116C3.21105 17.5139 2.43882 15.3749 3.45036 13.8012L4.5578 12.0782C5.00972 11.3752 5.25087 10.5491 5.25087 9.7041V9C5.25087 5.13401 8.27256 2 12 2C15.7274 2 18.7491 5.13401 18.7491 9Z"
          fill="currentColor"
        />
        <path
          d="M7.24316 18.5454C7.8941 20.5506 9.77767 22.0002 11.9998 22.0002C14.222 22.0002 16.1055 20.5506 16.7565 18.5454C13.611 19.1357 10.3886 19.1357 7.24316 18.5454Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="m4.5 12.5 5 5 10-11" />
    </>
  ));
}

export function GripIcon(props: IconProps) {
  return base(props, (
    <>
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </>
  ));
}

export function MoreIcon(props: IconProps) {
  return base(props, (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ));
}

export function EditIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ));
}

export function EyeIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          d="M12 4C17.2537 4 19.4885 7.45014 20.4037 9.81894C20.7417 10.6937 20.9107 11.131 20.6127 11.5655C20.3148 12 19.788 12 18.7344 12H5.26556C4.21197 12 3.68518 12 3.38726 11.5655C3.08933 11.131 3.25832 10.6937 3.59628 9.81894C4.51152 7.45014 6.74632 4 12 4Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <circle cx="12" cy="11" r="4" fill="currentColor" />
      </g>
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M6 6l12 12M18 6 6 18" />
    </>
  ));
}

export function PrinterIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          d="M17.1211 2.87868C16.2424 2 14.8282 2 11.9998 2C9.17134 2 7.75712 2 6.87844 2.87868C6.38608 3.37105 6.16961 4.03157 6.07444 5.01484C6.63368 4.99996 7.25183 4.99998 7.92943 5H16.0706C16.748 4.99998 17.366 4.99996 17.9251 5.01483C17.8299 4.03156 17.6135 3.37105 17.1211 2.87868Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M18 14.5C18 17.3284 18 20.2426 17.1213 21.1213C16.2426 22 14.8284 22 12 22C9.17158 22 7.75736 22 6.87868 21.1213C6 20.2426 6 17.3284 6 14.5H18ZM15.75 16.75C15.75 17.1642 15.4142 17.5 15 17.5H9C8.58579 17.5 8.25 17.1642 8.25 16.75C8.25 16.3358 8.58579 16 9 16H15C15.4142 16 15.75 16.3358 15.75 16.75ZM13.75 19.75C13.75 20.1642 13.4142 20.5 13 20.5H9C8.58579 20.5 8.25 20.1642 8.25 19.75C8.25 19.3358 8.58579 19 9 19H13C13.4142 19 13.75 19.3358 13.75 19.75Z"
          fill="currentColor"
        />
        <g opacity="0.24">
          <path
            d="M15 17.5C15.4142 17.5 15.75 17.1642 15.75 16.75C15.75 16.3358 15.4142 16 15 16H9C8.58579 16 8.25 16.3358 8.25 16.75C8.25 17.1642 8.58579 17.5 9 17.5H15Z"
            fill="currentColor"
          />
          <path
            d="M13 20.5C13.4142 20.5 13.75 20.1642 13.75 19.75C13.75 19.3358 13.4142 19 13 19H9C8.58579 19 8.25 19.3358 8.25 19.75C8.25 20.1642 8.58579 20.5 9 20.5H13Z"
            fill="currentColor"
          />
        </g>
        <path
          opacity="0.24"
          d="M16 6H8C5.17157 6 3.75736 6 2.87868 6.87868C2 7.75736 2 9.17157 2 12C2 14.8284 2 16.2426 2.87868 17.1213C3.37323 17.6159 4.03743 17.8321 5.02795 17.9266C4.99998 17.2038 4.99999 15.3522 5 14.5C4.72386 14.5 4.5 14.2761 4.5 14C4.5 13.7239 4.72386 13.5 5 13.5H19C19.2761 13.5 19.5 13.7239 19.5 14C19.5 14.2761 19.2761 14.5003 19 14.5003C19 15.3525 19 17.2039 18.9721 17.9266C19.9626 17.8321 20.6268 17.6159 21.1213 17.1213C22 16.2426 22 14.8284 22 12C22 9.17157 22 7.75736 21.1213 6.87868C20.2426 6 18.8284 6 16 6Z"
          fill="currentColor"
        />
        <path d="M9 10.75C9.41421 10.75 9.75 10.4142 9.75 10C9.75 9.58579 9.41421 9.25 9 9.25H6C5.58579 9.25 5.25 9.58579 5.25 10C5.25 10.4142 5.58579 10.75 6 10.75H9Z" fill="currentColor" />
        <path d="M18 10C18 10.5523 17.5523 11 17 11C16.4477 11 16 10.5523 16 10C16 9.44772 16.4477 9 17 9C17.5523 9 18 9.44772 18 10Z" fill="currentColor" />
      </g>
    </svg>
  );
}

export function RefundIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v5h5" />
    </>
  ));
}

export function RefreshIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 6.2" />
      <path d="M20 4v7h-7" />
    </>
  ));
}

export function PauseIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M8 5v14" />
      <path d="M16 5v14" />
    </>
  ));
}

export function PlayIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="m8 5 11 7-11 7Z" />
    </>
  ));
}

export function ChartPieIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          opacity="0.24"
          d="M6.22209 4.60105C6.66665 4.304 7.13344 4.04636 7.6171 3.82976C8.98898 3.21539 9.67491 2.9082 10.5875 3.4994C11.5 4.09061 11.5 5.06041 11.5 7.00001V8.50001C11.5 10.3856 11.5 11.3284 12.0858 11.9142C12.6716 12.5 13.6144 12.5 15.5 12.5H17C18.9396 12.5 19.9094 12.5 20.5006 13.4125C21.0918 14.3251 20.7846 15.011 20.1702 16.3829C19.9536 16.8666 19.696 17.3334 19.399 17.7779C18.3551 19.3402 16.8714 20.5578 15.1355 21.2769C13.3996 21.9959 11.4895 22.184 9.64665 21.8175C7.80383 21.4509 6.11109 20.5461 4.78249 19.2175C3.45389 17.8889 2.5491 16.1962 2.18254 14.3534C1.81598 12.5105 2.00412 10.6004 2.72315 8.86451C3.44218 7.12861 4.65982 5.64492 6.22209 4.60105Z"
          fill="currentColor"
        />
        <path
          d="M21.446 7.06901C20.6342 5.00831 18.9917 3.36579 16.931 2.55398C15.3895 1.94669 14 3.34316 14 5.00002V9.00002C14 9.5523 14.4477 10 15 10H19C20.6569 10 22.0533 8.61055 21.446 7.06901Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          d="M3 6.38597C3 5.90152 3.34538 5.50879 3.77143 5.50879L6.43567 5.50832C6.96502 5.49306 7.43202 5.11033 7.61214 4.54412C7.61688 4.52923 7.62232 4.51087 7.64185 4.44424L7.75665 4.05256C7.8269 3.81241 7.8881 3.60318 7.97375 3.41617C8.31209 2.67736 8.93808 2.16432 9.66147 2.03297C9.84457 1.99972 10.0385 1.99986 10.2611 2.00002H13.7391C13.9617 1.99986 14.1556 1.99972 14.3387 2.03297C15.0621 2.16432 15.6881 2.67736 16.0264 3.41617C16.1121 3.60318 16.1733 3.81241 16.2435 4.05256L16.3583 4.44424C16.3778 4.51087 16.3833 4.52923 16.388 4.54412C16.5682 5.11033 17.1278 5.49353 17.6571 5.50879H20.2286C20.6546 5.50879 21 5.90152 21 6.38597C21 6.87043 20.6546 7.26316 20.2286 7.26316H3.77143C3.34538 7.26316 3 6.87043 3 6.38597Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M9.42543 11.4815C9.83759 11.4381 10.2051 11.7547 10.2463 12.1885L10.7463 17.4517C10.7875 17.8855 10.4868 18.2724 10.0747 18.3158C9.66253 18.3592 9.29499 18.0426 9.25378 17.6088L8.75378 12.3456C8.71256 11.9118 9.01327 11.5249 9.42543 11.4815Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M14.5747 11.4815C14.9868 11.5249 15.2875 11.9118 15.2463 12.3456L14.7463 17.6088C14.7051 18.0426 14.3376 18.3592 13.9254 18.3158C13.5133 18.2724 13.2126 17.8855 13.2538 17.4517L13.7538 12.1885C13.795 11.7547 14.1625 11.4381 14.5747 11.4815Z"
          fill="currentColor"
        />
        <path
          opacity="0.24"
          d="M11.5956 22.0001H12.4044C15.1871 22.0001 16.5785 22.0001 17.4831 21.1142C18.3878 20.2283 18.4803 18.7751 18.6654 15.8686L18.9321 11.6807C19.0326 10.1037 19.0828 9.31524 18.6289 8.81558C18.1751 8.31592 17.4087 8.31592 15.876 8.31592H8.12405C6.59127 8.31592 5.82488 8.31592 5.37105 8.81558C4.91722 9.31524 4.96744 10.1037 5.06788 11.6807L5.33459 15.8686C5.5197 18.7751 5.61225 20.2283 6.51689 21.1142C7.42153 22.0001 8.81289 22.0001 11.5956 22.0001Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12" />
      <path d="M22 2L13.8 10.2" />
      <path d="M13 6.17004V11H17.83" />
    </>
  ));
}

export function DownloadIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12" />
      <path d="M13 11L21.2 2.80005" />
      <path d="M21.9999 6.83V2H17.1699" />
    </>
  ));
}

export function HistoryIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          opacity="0.24"
          d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="0.5 3.5"
        />
        <path d="M22 12C22 6.47715 17.5228 2 12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 9V13H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function ReservationIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path
          d="M21.9707 18V19C21.9707 20.65 21.9707 22 18.9707 22H4.9707C1.9707 22 1.9707 20.65 1.9707 19V18C1.9707 17.45 2.4207 17 2.9707 17H20.9707C21.5207 17 21.9707 17.45 21.9707 18Z"
          fill="currentColor"
        />
        <path
          opacity="0.24"
          d="M20.7195 13V17H3.26953V13C3.26953 9.16 5.97953 5.95 9.58953 5.18C10.1295 5.06 10.6895 5 11.2695 5H12.7195C13.2995 5 13.8695 5.06 14.4095 5.18C18.0195 5.96 20.7195 9.16 20.7195 13Z"
          fill="currentColor"
        />
        <path
          d="M14.5 4.5C14.5 4.74 14.47 4.96 14.41 5.18C13.87 5.06 13.3 5 12.72 5H11.27C10.69 5 10.13 5.06 9.59 5.18C9.53 4.96 9.5 4.74 9.5 4.5C9.5 3.12 10.62 2 12 2C13.38 2 14.5 3.12 14.5 4.5Z"
          fill="currentColor"
        />
        <path d="M15 11.75H9C8.59 11.75 8.25 11.41 8.25 11C8.25 10.59 8.59 10.25 9 10.25H15C15.41 10.25 15.75 10.59 15.75 11C15.75 11.41 15.41 11.75 15 11.75Z" fill="currentColor" />
      </g>
    </svg>
  );
}

export function VoucherIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M3 5h18v5l-2 2 2 2v5H3v-5l2-2-2-2z" />
      <path d="M6.5 3.5h11M6.5 20.5h11" />
      <path d="M12 8.5c-1.4 0-2 .8-2 1.75 0 2.25 4 1.25 4 3.5 0 .95-.6 1.75-2 1.75s-2-.8-2-1.75" />
      <path d="M12 7v1.5M12 15.5V17" />
    </>
  ));
}

export function PaletteIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M12 21a9 9 0 1 1 9-9c0 2.5-2 3-3.5 3H15a2 2 0 0 0-1.5 3.3c.6.7.1 2.7-1.5 2.7Z" />
      <path d="M8.5 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" stroke="none" />
      <path d="M12 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" stroke="none" />
    </>
  ));
}

export function UpdaterIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </>
  ));
}

export function SendIcon(props: IconProps) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4Z" />
    </svg>
  );
}

export function HelpIcon(props: IconProps) {
  return base(props, (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </>
  ));
}

export function MailIcon(props: IconProps) {
  return base(props, (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ));
}

export function PhoneIcon(props: IconProps) {
  return base(props, (
    <>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </>
  ));
}

export function ClipboardIcon(props: IconProps) {
  return base(props, (
    <>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V4" strokeLinejoin="round" />
      <path d="M9.5 9h5M9.5 12.5h5M9.5 16h3" strokeLinecap="round" />
    </>
  ));
}

export const NAV_ICONS = {
  dashboard: DashboardIcon,
  pos: PosIcon,
  reservation: ReservationIcon,
  voucher: VoucherIcon,
  money: WalletIcon,
  expenses: WalletIcon,
  purchases: PurchasesIcon,
  returns: ReturnsIcon,
  refund: RefundIcon,
  inventory: InventoryIcon,
  products: ProductsIcon,
  user: UserIcon,
  reports: ReportsIcon,
  analytics: ChartPieIcon,
  print: PrinterIcon,
  settings: SettingsIcon,
  help: HelpIcon,
  users: UsersIcon,
  audit: HistoryIcon,
} as const;

export type NavIconKey = keyof typeof NAV_ICONS;
