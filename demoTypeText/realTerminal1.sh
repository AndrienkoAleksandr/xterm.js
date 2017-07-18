#!/bin/bash

reset

sleep 3;
echo -e "[0;0H\c";
sleep 3;

echo -e "]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# \c";
echo -e "\r[K[root@60617cc44283 terminal]# \c";
echo -e "\r\n]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# \c";
echo -e "\r\n]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# test\c";
echo -e "\r\n]0;@60617cc44283:/terminal[root@60617cc44283 terminal]# test\c";
sleep 3;
echo -e "\r\n[?1049h\c";
sleep 5;

echo -e "[24;1H\c";

sleep 3;
echo -e "[?1049l\c";
echo -e "[?1049h\c";
echo -e "[12;35H\c";
echo -e "(B[30m[46m test\c";
sleep 3;

echo -e "[1;1H\c";

reset
