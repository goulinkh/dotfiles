# Canonical OpenVPN control. Sourced from .zshrc.
#
# Profiles are systemd units installed by ~/.config/openvpn/install-service.sh,
# one per region: openvpn-client@canonical-{uk,us,tw}.
#
#   vpn               status of every installed profile
#   vpn up [region]   connect (default: the first installed profile)
#   vpn down [region] disconnect (default: everything running)
#   vpn log [region]  follow the tunnel's journal

function vpn() {
	emulate -L zsh
	setopt local_options

	# Installed profiles. /etc/openvpn/client is 0755, so the glob works
	# unprivileged even though the configs themselves are root-only.
	local -a confs=(/etc/openvpn/client/canonical-*.conf(N))
	local -a installed=(${${confs:t:r}#canonical-})

	# Running profiles. systemd drops a runtime marker per active unit, which
	# beats forking systemctl just to render a status line.
	local -a units=(/run/systemd/units/invocation:openvpn-client@canonical-*.service(N))
	local -a running=(${${${units:t}#invocation:openvpn-client@canonical-}%.service})

	local cmd=${1:-status} region=$2

	case $cmd in
	status | st)
		if (( $#running )); then
			print -P "%F{green}▲ connected%f  ${(j:, :)running}"
			ip -br addr show tun0 2>/dev/null
			resolvectl status tun0 2>/dev/null |
				grep -E 'DNS Servers|DNS Domain|Default Route'
		else
			print -P "%F{yellow}▽ disconnected%f"
		fi
		(( $#installed )) && print -P "%F{244}installed: ${(j:, :)installed}%f"
		;;
	up | connect)
		: ${region:=${installed[1]:-uk}}
		if (( ! ${installed[(I)$region]} )); then
			print -u2 "no profile for '$region'; install it with:"
			print -u2 "  sudo ~/.config/openvpn/install-service.sh $region"
			return 1
		fi
		# Every region pushes the same internal prefixes, so only one may run.
		local other
		for other in ${running:#$region}; do
			print -P "%F{244}stopping canonical-$other (routes would collide)%f"
			sudo systemctl stop "openvpn-client@canonical-$other" || return
		done
		sudo systemctl restart "openvpn-client@canonical-$region" || return
		print -P "%F{green}▲ canonical-$region up%f"
		;;
	down | disconnect)
		local -a targets=(${region:-$running})
		if (( ! $#targets )); then
			print -P "%F{yellow}nothing to disconnect%f"
			return
		fi
		sudo systemctl stop ${targets/#/openvpn-client@canonical-} || return
		print -P "%F{yellow}▽ ${(j:, :)targets} down%f"
		;;
	log | logs)
		: ${region:=${running[1]:-${installed[1]:-uk}}}
		journalctl -u "openvpn-client@canonical-$region" -f
		;;
	*)
		print -u2 "usage: vpn [status|up|down|log] [region]"
		return 2
		;;
	esac
}

function _vpn() {
	if (( CURRENT == 2 )); then
		compadd -- status up down log
	elif (( CURRENT == 3 )); then
		local -a confs=(/etc/openvpn/client/canonical-*.conf(N))
		compadd -- ${${confs:t:r}#canonical-}
	fi
}
(( $+functions[compdef] )) && compdef _vpn vpn
