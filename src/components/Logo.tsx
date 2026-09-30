export default function Logo({ size = 40 }: { size?: number }) {
  return <img src="/logo.svg" width={size} height={size} alt="" aria-hidden="true" />
}
